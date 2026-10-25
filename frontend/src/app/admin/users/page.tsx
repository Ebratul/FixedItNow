import type { Metadata } from "next";
import { UsersList } from "@/components/admin/people/users-list";

export const metadata: Metadata = { title: "Users", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminUsersPage() {
  return <UsersList />;
}
