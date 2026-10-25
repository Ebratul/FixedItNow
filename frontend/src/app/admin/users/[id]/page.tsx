import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserDetailView } from "@/components/admin/people/user-detail";

export const metadata: Metadata = { title: "User", robots: { index: false, follow: false } };

/** Better Auth ids are short alphanumeric strings (the API accepts the same shape). */
const USER_ID = /^[A-Za-z0-9_-]{8,64}$/;

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  if (!USER_ID.test(id)) notFound();
  return <UserDetailView id={id} />;
}
