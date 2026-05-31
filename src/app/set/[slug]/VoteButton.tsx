"use client";

import { useState } from "react";
import { Eye, Check } from "lucide-react";
import { BrickButton } from "@/components/ui/BrickButton";

interface VoteButtonProps {
  setNumber: string;
  initialVoteCount: number;
}

export function VoteButton({ setNumber, initialVoteCount }: VoteButtonProps) {
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleVote() {
    if (hasVoted || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/sets/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setNumber }),
      });
      const json = await res.json();
      if (res.ok) {
        setVoteCount(json.voteCount);
        setHasVoted(true);
      } else if (res.status === 409) {
        setHasVoted(true);
      }
    } catch {
      // fail silently — voting is non-critical
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <BrickButton
        variant={hasVoted ? "ghost" : "secondary"}
        size="md"
        onClick={handleVote}
        disabled={hasVoted || loading}
        className="flex items-center gap-2"
      >
        {hasVoted ? (
          <>
            <Check className="w-4 h-4" aria-hidden />
            Watching
          </>
        ) : (
          <>
            <Eye className="w-4 h-4" aria-hidden />
            {loading ? "Adding..." : "Watch this set"}
          </>
        )}
      </BrickButton>
      <p className="type-eyebrow text-slate-500">
        {voteCount > 0
          ? `${voteCount.toLocaleString()} ${voteCount === 1 ? "person" : "people"} watching`
          : "Be the first to watch"}
      </p>
    </div>
  );
}
