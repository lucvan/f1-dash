import { redirect } from "next/navigation";

// Home landing screen disabled — send visitors straight to the live dashboard.
// The original marketing landing page lives in git history (branch: local/skip-home-screen base).
export default function Home() {
	redirect("/dashboard");
}
