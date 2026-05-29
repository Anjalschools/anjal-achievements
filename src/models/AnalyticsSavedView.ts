import mongoose, { Document, Model, Schema } from "mongoose";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";

export type AnalyticsSavedViewScope = "participation" | "reports";

export type AnalyticsSavedViewUiState = {
  tab?: string;
  page?: number;
  focusedPage?: number;
  focusedOutcome?: string;
  focusedPick?: string;
  compareEnabled?: boolean;
  comparePick?: string;
  pdfPreset?: string;
  tableMode?: string;
  sortKey?: string;
  sortAsc?: boolean;
  primaryType?: string;
};

export interface IAnalyticsSavedView extends Document {
  name: string;
  scope: AnalyticsSavedViewScope;
  createdBy: mongoose.Types.ObjectId;
  filterSnapshot: ExecutiveFilterSnapshot;
  uiSnapshot: AnalyticsSavedViewUiState;
  shareSlug?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsSavedViewSchema = new Schema<IAnalyticsSavedView>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    scope: { type: String, enum: ["participation", "reports"], required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    filterSnapshot: { type: Schema.Types.Mixed, required: true },
    uiSnapshot: { type: Schema.Types.Mixed, default: () => ({}) },
    shareSlug: { type: String, trim: true, sparse: true, unique: true },
  },
  { timestamps: true }
);

AnalyticsSavedViewSchema.index({ createdBy: 1, scope: 1, updatedAt: -1 });

const AnalyticsSavedView: Model<IAnalyticsSavedView> =
  mongoose.models.AnalyticsSavedView ||
  mongoose.model<IAnalyticsSavedView>("AnalyticsSavedView", AnalyticsSavedViewSchema);

export default AnalyticsSavedView;
