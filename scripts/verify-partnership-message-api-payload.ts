/**
 * T.1.2.F.0 — Read-only API payload verification.
 * Invokes listPartnershipThreadMessages() (same path as GET /api/partnerships/messages).
 */
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const CASE_LETTER: Record<1 | 2 | 3 | 4, "A" | "B" | "C" | "D"> = {
  1: "A",
  2: "B",
  3: "C",
  4: "D",
};

const pickVerificationFields = (row: {
  id: string;
  senderId?: string;
  currentUserId?: string;
  isMine?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canRestore?: boolean;
  messageType?: string;
  templateKey?: string | null;
}) => ({
  id: row.id,
  senderId: row.senderId ?? "",
  currentUserId: row.currentUserId ?? "",
  isMine: row.isMine === true,
  canEdit: row.canEdit === true,
  canDelete: row.canDelete === true,
  canRestore: row.canRestore === true,
  messageType: row.messageType ?? "user",
  templateKey: row.templateKey ?? null,
});

const main = async () => {
  const mongoose = (await import("mongoose")).default;
  const User = (await import("../src/models/User")).default;
  const PartnershipMessage = (await import("../src/models/PartnershipMessage")).default;
  const { listPartnershipThreadMessages } = await import(
    "../src/lib/partnerships/partnership-messaging-service"
  );
  const {
    buildPartnershipMessagePermissionTraceRow,
    classifyPartnershipMessagePermissionCase,
  } = await import("../src/lib/partnerships/partnership-message-permission-trace");

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(JSON.stringify({ error: "MONGODB_URI not set" }));
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: "anjal_achievements" });

  const roles = ["admin", "partnershipSupervisor", "schoolAdmin", "teacher"] as const;
  const viewers = await User.find({ role: { $in: [...roles] } })
    .select("_id role email fullNameAr fullName")
    .limit(10)
    .lean();

  if (!viewers.length) {
    console.log(JSON.stringify({ error: "No supervisor users found", case: "D" }, null, 2));
    process.exit(0);
  }

  const supervisorMessages = await PartnershipMessage.find({
    senderRole: "supervisor",
    isDeleted: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  if (!supervisorMessages.length) {
    console.log(JSON.stringify({ error: "No supervisor messages in DB", case: "D" }, null, 2));
    process.exit(0);
  }

  const results: Array<{
    viewerRole: string;
    viewerId: string;
    viewerEmail: string;
    threadId: string;
    payload: ReturnType<typeof pickVerificationFields>;
    case: "A" | "B" | "C" | "D";
    rawDb: {
      messageType?: string;
      templateKey?: string;
      metadata?: Record<string, unknown>;
    };
  }> = [];

  for (const msg of supervisorMessages) {
    const threadId = String(msg.threadId);
    const senderId = String(msg.senderId);

    for (const viewer of viewers) {
      const viewerId = String(viewer._id);
      const viewerRole = String(viewer.role || "");

      try {
        const data = await listPartnershipThreadMessages({
          threadId,
          userId: new mongoose.Types.ObjectId(viewerId),
          role: viewerRole,
          includePermissionTrace: true,
        });

        const item = data.items.find((row) => row.id === String(msg._id));
        if (!item) {
          results.push({
            viewerRole,
            viewerId,
            viewerEmail: String(viewer.email || ""),
            threadId,
            payload: {
              id: String(msg._id),
              senderId,
              currentUserId: data.currentUserId,
              isMine: false,
              canEdit: false,
              canDelete: false,
              canRestore: false,
              messageType: String(msg.messageType || "user"),
              templateKey: msg.templateKey ? String(msg.templateKey) : null,
            },
            case: "D",
            rawDb: {
              messageType: msg.messageType,
              templateKey: msg.templateKey,
              metadata: msg.metadata as Record<string, unknown> | undefined,
            },
          });
          continue;
        }

        const trace = buildPartnershipMessagePermissionTraceRow(item, data.currentUserId);
        results.push({
          viewerRole,
          viewerId,
          viewerEmail: String(viewer.email || ""),
          threadId,
          payload: pickVerificationFields(item),
          case: CASE_LETTER[trace.permissionCase],
          rawDb: {
            messageType: msg.messageType,
            templateKey: msg.templateKey,
            metadata: msg.metadata as Record<string, unknown> | undefined,
          },
        });

        if (viewerId === senderId) break;
      } catch {
        // thread access denied for this viewer — skip
      }
    }
  }

  const ownedByViewer = results.filter((r) => r.viewerId === r.payload.senderId);
  const primary =
    ownedByViewer.find((r) => r.case === "A") ??
    ownedByViewer[0] ??
    results.find((r) => r.case === "A") ??
    results[0];

  if (!primary) {
    console.log(JSON.stringify({ case: "D", error: "No verifiable thread/message pairs" }, null, 2));
    process.exit(0);
  }

  const permissionCase = classifyPartnershipMessagePermissionCase({
    foundInPayload: primary.case !== "D",
    isMine: primary.payload.isMine,
    canEdit: primary.payload.canEdit,
    canDelete: primary.payload.canDelete,
  });

  console.log(
    JSON.stringify(
      {
        case: CASE_LETTER[permissionCase],
        inspectedMessage: primary.payload,
        context: {
          viewerRole: primary.viewerRole,
          viewerId: primary.viewerId,
          viewerEmail: primary.viewerEmail,
          threadId: primary.threadId,
          rawDbMessage: primary.rawDb,
        },
        sampleCount: results.length,
        ownedMessageSamples: ownedByViewer.slice(0, 5).map((r) => ({
          case: r.case,
          viewerRole: r.viewerRole,
          payload: r.payload,
        })),
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
