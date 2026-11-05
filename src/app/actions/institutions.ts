"use server";

// Institutions and donations (PRD 5.2): registering a library or community
// centre, managing donation requests, and pledging books to them.

import { revalidatePath } from "next/cache";
import type { DonationStatus, HandoverMethod, InstitutionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { isBlockedEitherWay } from "@/lib/blocks";
import { DONATION_STATUS_LABEL, HANDOVER_METHODS, INSTITUTION_TYPES } from "@/lib/trust-labels";
import type { FormState } from "./auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function parseWebsite(raw: string): { ok: true; value: string | null } | { ok: false } {
  if (!raw) return { ok: true, value: null };
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) return { ok: false };
    return { ok: true, value: u.toString() };
  } catch {
    return { ok: false };
  }
}

type ProfileFields = {
  name: string;
  type: InstitutionType;
  description: string | null;
  publicAddress: string | null;
  neighbourhood: string | null;
  website: string | null;
};

function parseInstitutionForm(fd: FormData): { error: string } | { data: ProfileFields } {
  const name = str(fd, "name");
  const type = str(fd, "type") as InstitutionType;
  const description = str(fd, "description");
  const publicAddress = str(fd, "publicAddress");
  const neighbourhood = str(fd, "neighbourhood");
  const website = parseWebsite(str(fd, "website"));

  if (name.length < 3 || name.length > 120) return { error: "Please enter the institution's name (3 to 120 characters)." };
  if (!INSTITUTION_TYPES.some((t) => t.value === type)) return { error: "Please choose what kind of place it is." };
  if (description.length > 1000) return { error: "Please keep the description under 1000 characters." };
  if (publicAddress.length > 300) return { error: "Please keep the address under 300 characters." };
  if (neighbourhood.length > 80) return { error: "Please keep the neighbourhood under 80 characters." };
  if (!website.ok) return { error: "That website address doesn't look right." };

  return {
    data: {
      name,
      type,
      description: description || null,
      publicAddress: publicAddress || null,
      neighbourhood: neighbourhood || null,
      website: website.value,
    },
  };
}

async function notifyAdmins(title: string, body: string, link: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  for (const a of admins) await notify({ userId: a.id, type: "ACCOUNT", title, body, link });
}

/** The caller's institution, if they may manage it (role INSTITUTION/ADMIN and VERIFIED). */
async function managedInstitution(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, institution: { select: { id: true, name: true, verificationStatus: true } } },
  });
  if (!user?.institution) return null;
  if (user.role !== "INSTITUTION" && user.role !== "ADMIN") return null;
  if (user.institution.verificationStatus !== "VERIFIED") return null;
  return user.institution;
}

// ───────────────────────────── Registration ─────────────────────────────

export async function registerInstitutionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  if (!rateLimit(`institution-register:${me.id}`, 5, 60 * 60_000)) {
    return { error: "Too many attempts. Please try again later." };
  }
  const parsed = parseInstitutionForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const existing = await prisma.institution.findUnique({ where: { userId: me.id }, select: { id: true, verificationStatus: true } });
  if (existing?.verificationStatus === "VERIFIED") {
    return { error: "Your institution is already verified. Edit its profile from the institution dashboard." };
  }

  const inst = existing
    ? await prisma.institution.update({
        where: { id: existing.id },
        data: { ...parsed.data, verificationStatus: "PENDING", verifiedAt: null, verifiedById: null },
        select: { id: true, name: true },
      })
    : await prisma.institution.create({
        data: { ...parsed.data, userId: me.id, verificationStatus: "PENDING" },
        select: { id: true, name: true },
      });

  await audit({
    actorId: me.id,
    action: existing ? "INSTITUTION_RESUBMITTED" : "INSTITUTION_REGISTERED",
    entityType: "Institution",
    entityId: inst.id,
    metadata: { name: inst.name, type: parsed.data.type },
  });
  // Notify admins on a new application, or when a rejected one is sent again.
  if (!existing || existing.verificationStatus === "REJECTED") {
    await notifyAdmins("Institution waiting for verification", `${inst.name} asked to join BookLoop as an institution.`, "/admin/institutions");
  }

  revalidatePath("/settings/institution");
  revalidatePath("/admin");
  return {
    success: existing
      ? "Saved. Your application is waiting for review."
      : "Thanks! A BookLoop admin will review your application and let you know.",
  };
}

export async function updateInstitutionProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const inst = await managedInstitution(me.id);
  if (!inst) return { error: "Only verified institutions can edit this profile." };
  const parsed = parseInstitutionForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  await prisma.institution.update({ where: { id: inst.id }, data: parsed.data });
  await audit({ actorId: me.id, action: "INSTITUTION_PROFILE_UPDATED", entityType: "Institution", entityId: inst.id });

  revalidatePath("/institution", "layout");
  revalidatePath("/community");
  return { success: "Profile saved." };
}

// ─────────────────────────── Donation requests ───────────────────────────

export async function saveDonationRequestAction(_prev: FormState, formData: FormData): Promise<FormState & { id?: string }> {
  const me = await requireUser();
  const inst = await managedInstitution(me.id);
  if (!inst) return { error: "Only verified institutions can publish donation requests." };
  if (!rateLimit(`donation-request:${me.id}`, 30, 60 * 60_000)) return { error: "Too many changes. Please try again later." };

  const id = str(formData, "id");
  const title = str(formData, "title");
  const description = str(formData, "description");
  const booksWanted = str(formData, "booksWanted");
  const dropOffInfo = str(formData, "dropOffInfo");
  const goalRaw = str(formData, "quantityGoal");
  const genreIds = formData.getAll("genres").map(String).slice(0, 20);

  if (title.length < 3 || title.length > 120) return { error: "Please give the request a title (3 to 120 characters)." };
  if (description.length > 2000) return { error: "Please keep the description under 2000 characters." };
  if (booksWanted.length > 1000) return { error: "Please keep the list of wanted books under 1000 characters." };
  if (dropOffInfo.length > 500) return { error: "Please keep the drop-off details under 500 characters." };
  let quantityGoal: number | null = null;
  if (goalRaw) {
    quantityGoal = Number(goalRaw);
    if (!Number.isInteger(quantityGoal) || quantityGoal < 1 || quantityGoal > 10000) {
      return { error: "The goal should be a whole number between 1 and 10000." };
    }
  }
  const genres = (await prisma.genre.findMany({ where: { id: { in: genreIds } }, select: { id: true } })).map((g) => ({ id: g.id }));

  const data = {
    title,
    description: description || null,
    booksWanted: booksWanted || null,
    dropOffInfo: dropOffInfo || null,
    quantityGoal,
  };

  let savedId: string;
  if (id) {
    const existing = await prisma.donationRequest.findUnique({ where: { id }, select: { institutionId: true } });
    if (!existing || existing.institutionId !== inst.id) return { error: "That request isn't yours to edit." };
    await prisma.donationRequest.update({ where: { id }, data: { ...data, genres: { set: genres } } });
    savedId = id;
  } else {
    const created = await prisma.donationRequest.create({
      data: { ...data, institutionId: inst.id, genres: { connect: genres } },
      select: { id: true },
    });
    savedId = created.id;
    await audit({ actorId: me.id, action: "DONATION_REQUEST_CREATED", entityType: "DonationRequest", entityId: savedId });
  }

  revalidatePath("/institution", "layout");
  revalidatePath("/community");
  return { success: id ? "Request saved." : "Request published.", id: savedId };
}

export async function setDonationRequestStatusAction(
  requestId: string,
  status: "OPEN" | "FULFILLED" | "CLOSED",
): Promise<{ error?: string }> {
  const me = await requireUser();
  const inst = await managedInstitution(me.id);
  if (!inst) return { error: "Only verified institutions can change donation requests." };
  if (!["OPEN", "FULFILLED", "CLOSED"].includes(status)) return { error: "Unknown status." };

  const req = await prisma.donationRequest.findUnique({ where: { id: requestId }, select: { institutionId: true } });
  if (!req || req.institutionId !== inst.id) return { error: "That request isn't yours to change." };

  await prisma.donationRequest.update({
    where: { id: requestId },
    data: { status, closedAt: status === "OPEN" ? null : new Date() },
  });
  await audit({ actorId: me.id, action: `DONATION_REQUEST_${status}`, entityType: "DonationRequest", entityId: requestId });

  revalidatePath("/institution", "layout");
  revalidatePath("/community");
  return {};
}

// ─────────────────────────────── Donations ───────────────────────────────

const NEXT: Record<DonationStatus, DonationStatus[]> = {
  PLEDGED: ["SCHEDULED", "RECEIVED", "CANCELLED"],
  SCHEDULED: ["SCHEDULED", "RECEIVED", "CANCELLED"],
  RECEIVED: [],
  CANCELLED: [],
};

export async function updateDonationStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const inst = await managedInstitution(me.id);
  if (!inst) return { error: "Only verified institutions can update donations." };

  const donationId = str(formData, "donationId");
  const status = str(formData, "status") as DonationStatus;
  const scheduledRaw = str(formData, "scheduledAt");

  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    select: {
      id: true,
      status: true,
      donorId: true,
      donationRequest: { select: { id: true, title: true, institutionId: true } },
    },
  });
  if (!donation || donation.donationRequest.institutionId !== inst.id) return { error: "That donation isn't for your institution." };
  if (!NEXT[donation.status].includes(status)) {
    return { error: `A ${DONATION_STATUS_LABEL[donation.status].toLowerCase()} donation can't be changed to that.` };
  }

  let scheduledAt: Date | undefined;
  if (status === "SCHEDULED") {
    const d = new Date(scheduledRaw);
    if (!scheduledRaw || Number.isNaN(d.getTime())) return { error: "Please choose a drop-off date and time." };
    if (d.getTime() < Date.now() - 60 * 60_000) return { error: "The drop-off time should be in the future." };
    scheduledAt = d;
  }

  await prisma.donation.update({
    where: { id: donation.id },
    data: {
      status,
      ...(scheduledAt ? { scheduledAt } : {}),
      ...(status === "RECEIVED" ? { receivedAt: new Date() } : {}),
    },
  });

  const when = scheduledAt?.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const body =
    status === "SCHEDULED"
      ? `${inst.name} scheduled your drop-off for ${when}.`
      : status === "RECEIVED"
        ? `${inst.name} received your books. Thank you for sharing!`
        : `${inst.name} cancelled this pledge.`;
  await notify({
    userId: donation.donorId,
    type: "DONATION_UPDATE",
    title: `Donation update: ${DONATION_STATUS_LABEL[status]}`,
    body: `${body} (${donation.donationRequest.title})`,
    link: "/community",
  });

  revalidatePath(`/institution/requests/${donation.donationRequest.id}`);
  revalidatePath("/institution");
  revalidatePath("/community");
  return { success: `Marked as ${DONATION_STATUS_LABEL[status].toLowerCase()}.` };
}

export async function pledgeDonationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  if (!rateLimit(`pledge:${me.id}`, 10, 60 * 60_000)) return { error: "Too many pledges at once. Please try again later." };

  const requestId = str(formData, "requestId");
  const description = str(formData, "description");
  const quantity = Number(str(formData, "quantity") || "1");
  const method = (str(formData, "handoverMethod") || "INSTITUTION_POINT") as HandoverMethod;

  if (description.length < 3) return { error: "Please describe the books you'd like to give." };
  if (description.length > 1000) return { error: "Please keep the description under 1000 characters." };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) return { error: "Quantity should be between 1 and 500." };
  if (!HANDOVER_METHODS.some((m) => m.value === method)) return { error: "Please choose how you'll hand the books over." };

  const req = await prisma.donationRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      title: true,
      status: true,
      institution: { select: { userId: true, name: true, verificationStatus: true } },
    },
  });
  if (!req || req.status !== "OPEN" || req.institution.verificationStatus !== "VERIFIED") {
    return { error: "This donation request isn't accepting pledges right now." };
  }
  if (req.institution.userId === me.id) return { error: "You can't pledge to your own request." };
  if (await isBlockedEitherWay(me.id, req.institution.userId)) return { error: "You can't pledge to this request." };

  const donation = await prisma.donation.create({
    data: { donationRequestId: req.id, donorId: me.id, description, quantity, handoverMethod: method },
    select: { id: true },
  });
  await audit({ actorId: me.id, action: "DONATION_PLEDGED", entityType: "Donation", entityId: donation.id, metadata: { quantity } });

  await notify({
    userId: req.institution.userId,
    type: "DONATION_UPDATE",
    title: "New book pledge",
    body: `Someone pledged ${quantity} ${quantity === 1 ? "book" : "books"} to "${req.title}".`,
    link: `/institution/requests/${req.id}`,
  });

  revalidatePath("/community");
  revalidatePath(`/institution/requests/${req.id}`);
  revalidatePath("/institution");
  return { success: `Thank you! ${req.institution.name} will be in touch about the drop-off.` };
}

export async function cancelPledgeAction(donationId: string): Promise<{ error?: string }> {
  const me = await requireUser();
  const d = await prisma.donation.findUnique({
    where: { id: donationId },
    select: { id: true, donorId: true, status: true, donationRequest: { select: { id: true, title: true, institution: { select: { userId: true } } } } },
  });
  if (!d || d.donorId !== me.id) return { error: "That pledge isn't yours." };
  if (d.status !== "PLEDGED" && d.status !== "SCHEDULED") return { error: "This pledge can no longer be cancelled." };

  await prisma.donation.update({ where: { id: d.id }, data: { status: "CANCELLED" } });
  await notify({
    userId: d.donationRequest.institution.userId,
    type: "DONATION_UPDATE",
    title: "A pledge was cancelled",
    body: `A donor cancelled their pledge to "${d.donationRequest.title}".`,
    link: `/institution/requests/${d.donationRequest.id}`,
  });

  revalidatePath("/community");
  revalidatePath(`/institution/requests/${d.donationRequest.id}`);
  return {};
}
