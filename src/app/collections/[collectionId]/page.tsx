import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { AddPhotosButton } from "@/components/collections/add-photos-button";
import { CollectionWall } from "@/components/collections/collection-wall";
import { getAccount } from "@/lib/auth/account";
import { signInPath } from "@/lib/auth/sign-in-path";
import { getCollection } from "@/lib/collections";

export const metadata: Metadata = { title: "Collection", robots: { index: false } };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** One collection, full screen: its photos on an endless wall. Only its owner can open it. */
export default function CollectionPage({ params }: PageProps<"/collections/[collectionId]">) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#141414] text-white">
      <Suspense fallback={null}>
        <Collection params={params} />
      </Suspense>
    </div>
  );
}

async function Collection({ params }: Pick<PageProps<"/collections/[collectionId]">, "params">) {
  const { collectionId } = await params;
  const account = await getAccount();
  if (!account) redirect(signInPath(`/collections/${collectionId}`));
  if (!UUID_PATTERN.test(collectionId)) notFound();
  const collection = await getCollection(collectionId, account.user.id);
  if (!collection) notFound();

  return (
    <>
      <CollectionWall photos={collection.photos} />
      {/* Over the wall: back, the name, and adding photos. Only the buttons take touches. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-gradient-to-b from-black/60 to-transparent px-[max(1rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))] pb-10">
        <Link
          href="/"
          aria-label="Back to collections"
          className="pointer-events-auto grid size-10 place-items-center rounded-full bg-white/10 backdrop-blur transition-colors hover:bg-white/20"
        >
          <ArrowLeftIcon className="size-4" />
        </Link>
        <div className="min-w-0 text-center">
          <h1 className="truncate font-serif text-2xl tracking-tight">{collection.title}</h1>
          <p className="text-xs text-white/60">
            {collection.photos.length} photo{collection.photos.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex justify-end">
          <AddPhotosButton collectionId={collection.id} />
        </div>
      </div>
    </>
  );
}
