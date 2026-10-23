import { Compass } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function NotFound() {
  return (
    <ComingSoon icon={Compass} title="Page not found">
      The page you are looking for does not exist or has moved.
    </ComingSoon>
  );
}
