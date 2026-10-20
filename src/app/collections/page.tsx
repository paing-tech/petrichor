import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewCollection } from "@/components/collections/new-collection";
import { getAccount } from "@/lib/auth/account";
import { signInPath } from "@/lib/auth/sign-in-path";
import { listCollections } from "@/lib/collections";

export const metadata: Metadata = { title: "Collections", robots: { index: false } };

/**
 * The signed-in home page: the account's photo collections. Visiting "/" while signed in
 * shows this page (see src/proxy.ts).
 */
export default function CollectionsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-4 pb-16 sm:px-6">
      <Suspense fallback={<h1 className="font-serif text-4xl tracking-tight">Collections</h1>}>
        <Collections />
      </Suspense>
    </div>
  );
}

async function Collections() {
  const account = await getAccount();
  if (!account) redirect(signInPath("/"));
  if (!account.profile) redirect("/onboarding?next=/");
  const collections = await listCollections(account.user.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Collections</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Photos from a trip, a season, a day, kept together at their original size.
          </p>
        </div>
        {collections.length > 0 && <NewCollection />}
      </div>

      {collections.length === 0 ? (
        <NewCollection startOpen />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link href={`/collections/${collection.id}`} className="group grid gap-2">
                <div className="bg-muted aspect-[4/5] overflow-hidden rounded-2xl">
                  {collection.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={collection.cover.previewUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{collection.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {collection.photoCount} photo{collection.photoCount === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
