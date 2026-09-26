import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign up | Exporters Assam",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
