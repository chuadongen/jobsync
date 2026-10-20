import { Metadata } from "next";
import AuthCard from "@/components/auth/AuthCard";
import { isSignupOpen } from "@/actions/auth.actions";

export const metadata: Metadata = {
  title: "Sign Up",
};

// Read per request: the answer changes the moment the account is created.
export const dynamic = "force-dynamic";

export default async function SignUp() {
  return <AuthCard mode="signup" signupOpen={await isSignupOpen()} />;
}
