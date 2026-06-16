import "server-only";
import type { NextRequest } from "next/server";
import type mongoose from "mongoose";
import type { IUser } from "@/models/User";
import { createTrainingOutcomeFromApproval } from "@/lib/partnerships/training-outcome-service";

/** Extension hook — does not modify Career / Achievement / Certificate engines. */
export const emitTrainingOutcomeOnFinalApproval = async (input: {
  applicationId: string;
  approvedBy: IUser & { _id: mongoose.Types.ObjectId };
  request?: NextRequest;
}): Promise<void> => {
  const result = await createTrainingOutcomeFromApproval(input);
  if (!result.ok && process.env.AI_DEBUG === "1") {
    console.warn("[training-outcome-hook]", result.error, input.applicationId);
  }
};
