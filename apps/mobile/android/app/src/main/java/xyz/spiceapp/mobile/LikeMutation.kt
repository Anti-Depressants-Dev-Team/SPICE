package xyz.spiceapp.mobile

internal enum class LikeMutationResolution {
    Confirm,
    RollBack,
    ReconcileNewerChange,
}

internal fun nextLikeState(currentlyLiked: Boolean): Boolean = !currentlyLiked

internal fun resolveLikeMutation(
    requestRevision: Long,
    latestRevision: Long,
    requestedLiked: Boolean,
    currentlyLiked: Boolean,
    succeeded: Boolean,
): LikeMutationResolution {
    if (requestRevision != latestRevision || requestedLiked != currentlyLiked) {
        return LikeMutationResolution.ReconcileNewerChange
    }
    return if (succeeded) LikeMutationResolution.Confirm else LikeMutationResolution.RollBack
}
