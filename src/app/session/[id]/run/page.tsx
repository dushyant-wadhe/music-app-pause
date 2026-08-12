import { redirect } from "next/navigation";

interface SessionRunPageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionRunPage({ params }: SessionRunPageProps) {
  const { id } = await params;
  redirect(`/session/${id}`);
}
