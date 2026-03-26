import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ContactMessageStatus = "new" | "in_progress" | "replied" | "archived";
export type ContactInquiryType = "general" | "achievements" | "activities" | "judging" | "technical";

export interface IContactMessage extends Document {
  fullName: string;
  phone: string;
  email: string;
  subject: string;
  inquiryType: ContactInquiryType;
  message: string;
  status: ContactMessageStatus;
  assignedRole?: string;
  assignedUserId?: mongoose.Types.ObjectId;
  replyText?: string;
  repliedAt?: Date;
  gender?: "male" | "female";
  section?: "arabic" | "international";
  grade?: string;
  campus?: string;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactMessageSchema = new Schema<IContactMessage>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 190 },
    subject: { type: String, required: true, trim: true, maxlength: 180 },
    inquiryType: {
      type: String,
      enum: ["general", "achievements", "activities", "judging", "technical"],
      default: "general",
    },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ["new", "in_progress", "replied", "archived"],
      default: "new",
      index: true,
    },
    assignedRole: { type: String, trim: true, maxlength: 80 },
    assignedUserId: { type: Schema.Types.ObjectId, ref: "User" },
    replyText: { type: String, trim: true, maxlength: 5000 },
    repliedAt: { type: Date },
    gender: { type: String, enum: ["male", "female"] },
    section: { type: String, enum: ["arabic", "international"] },
    grade: { type: String, trim: true, maxlength: 50 },
    campus: { type: String, trim: true, maxlength: 120 },
    source: { type: String, trim: true, maxlength: 40, default: "public_contact" },
  },
  { timestamps: true }
);

ContactMessageSchema.index({ createdAt: -1 });
ContactMessageSchema.index({ inquiryType: 1, status: 1 });

const ContactMessage: Model<IContactMessage> =
  mongoose.models.ContactMessage || mongoose.model<IContactMessage>("ContactMessage", ContactMessageSchema);

export default ContactMessage;
