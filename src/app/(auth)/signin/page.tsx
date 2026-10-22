import { Metadata } from "next";
import AuthCard from "@/components/auth/AuthCard";
import { isSignupOpen } from "@/actions/auth.actions";

export const metadata: Metadata = {
  title: "Sign In",
};

// Read per request: the answer changes the moment the account is created.
export const dynamic = "force-dynamic";

export default async function SignIn() {
  return <AuthCard mode="signin" signupOpen={await isSignupOpen()} />;
}
