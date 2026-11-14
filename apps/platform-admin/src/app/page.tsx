import { AdminSignIn } from "../features/auth/admin-sign-in";

export default function AdminPage() {
  return <main className="grid min-h-screen place-items-center bg-background p-5">
    <div className="w-full max-w-md"><AdminSignIn /></div>
  </main>;
}
