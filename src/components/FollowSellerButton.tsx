"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  followSellerAction,
  unfollowSellerAction,
  type SellerFollowFormState,
} from "@/server/sellerFollow/actions";

export function FollowSellerButton({
  sellerId,
  storeSlug,
  initialFollowing,
  signedIn,
}: {
  sellerId: string;
  storeSlug: string;
  initialFollowing: boolean;
  signedIn: boolean;
}) {
  const boundFollow = followSellerAction.bind(null, sellerId, storeSlug);
  const boundUnfollow = unfollowSellerAction.bind(null, sellerId, storeSlug);
  const [followState, followAction, followPending] = useActionState<SellerFollowFormState, FormData>(
    boundFollow,
    {},
  );
  const [unfollowState, unfollowAction, unfollowPending] = useActionState<
    SellerFollowFormState,
    FormData
  >(boundUnfollow, {});

  if (!signedIn) {
    return null;
  }

  const following = initialFollowing ? !unfollowState.success : Boolean(followState.success);

  if (following) {
    return (
      <form action={unfollowAction}>
        <Button type="submit" variant="outline" size="sm" loading={unfollowPending}>
          Following
        </Button>
      </form>
    );
  }

  return (
    <form action={followAction}>
      <Button type="submit" variant="secondary" size="sm" loading={followPending}>
        Follow
      </Button>
    </form>
  );
}
