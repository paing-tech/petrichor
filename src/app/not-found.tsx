import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="font-serif text-4xl">Nothing here</h1>
      <p className="text-muted-foreground text-sm">
        This card doesn&apos;t exist. Check that the link was copied in full.
      </p>
      <Button asChild>
        <Link href="/create">Make a card</Link>
      </Button>
    </div>
  );
}
