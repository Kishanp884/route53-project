"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => router.replace("/route53/v2/dashboard"), [router]);
  return null;
}
