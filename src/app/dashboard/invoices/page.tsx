"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InvoicesRedirectPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to transactions page
    router.push("/dashboard/transactions");
  }, [router]);
  
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Redirecting to Transactions...</h2>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    </div>
  );
}
