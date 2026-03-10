import mongoose, { ClientSession } from "mongoose";

function isTransactionUnsupported(error: unknown) {
  const message = String((error as any)?.message || "");
  return (
    message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
    message.includes("does not support retryable writes") ||
    message.includes("replica set")
  );
}

export async function runAtomic<T>(work: (session: ClientSession | null) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      return work(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

