"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTransactionSchema, CreateTransactionInput } from "@/schemas/transaction.schema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTransaction(data: CreateTransactionInput) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const parsed = createTransactionSchema.safeParse(data);
  if (!parsed.success) {
      throw new Error("Invalid transaction data");
  }

  const { type, amount, date, description } = parsed.data;
  let transactionName = description || "";

  if (!transactionName) {
      if (type === "EXPENSE" || type === "INCOME") {
          // We need to fetch category name
          // Since we are inside a server action, we can query prisma
          const categoryId = (parsed.data as any).categoryId;
          // Note: using any cast because typescript might not narrow discriminated union perfectly
          // when accessing property that exists in some but not all, although here we are inside if blocks.
          // Actually, let's do it properly inside the if blocks.
      }
  }

  try {
      if (type === "EXPENSE") {
          const { walletId, categoryId } = parsed.data;

          if (!transactionName) {
              const category = await prisma.category.findUnique({
                  where: { id: categoryId },
              });
              transactionName = category?.name || "Uncategorized Expense";
          }

          await prisma.$transaction([
              // create transaction
              prisma.transaction.create({
                  data: {
                      userId: user.id,
                      amount,
                      date,
                      name: transactionName,
                      type: "EXPENSE",
                      walletId,
                      categoryId,
                  }
              }),
              // update wallet balance (decrement)
              prisma.wallet.update({
                  where: { id: walletId },
                  data: {
                      balance: {
                          decrement: amount,
                      }
                  }
              })
          ]);

      } else if (type === "INCOME") {
          const { walletId, categoryId } = parsed.data;

          if (!transactionName) {
              const category = await prisma.category.findUnique({
                  where: { id: categoryId },
              });
              transactionName = category?.name || "Uncategorized Income";
          }

          await prisma.$transaction([
              // create transaction
              prisma.transaction.create({
                  data: {
                      userId: user.id,
                      amount,
                      date,
                      name: transactionName,
                      type: "INCOME",
                      walletId,
                      categoryId,
                  }
              }),
              // update wallet balance (increment)
              prisma.wallet.update({
                  where: { id: walletId },
                  data: {
                      balance: {
                          increment: amount,
                      }
                  }
              })
          ]);
      } else if (type === "TRANSFER") {
          const { walletId: sourceWalletId, destinationWalletId } = parsed.data;

          const sourceWallet = await prisma.wallet.findUnique({ where: { id: sourceWalletId }});
          const destWallet = await prisma.wallet.findUnique({ where: { id: destinationWalletId }});

          const sourceName = sourceWallet?.name || "Unknown Wallet";
          const destName = destWallet?.name || "Unknown Wallet";

          await prisma.$transaction([
              // 1. Decrement source wallet
              prisma.wallet.update({
                  where: { id: sourceWalletId },
                  data: { balance: { decrement: amount } }
              }),
              // 2. Increment dest wallet
              prisma.wallet.update({
                  where: { id: destinationWalletId },
                  data: { balance: { increment: amount } }
              }),
              // 3. Create 'Transfer Out' transaction for source
              prisma.transaction.create({
                  data: {
                      userId: user.id,
                      amount,
                      date,
                      name: transactionName || `Transfer to ${destName}`,
                      type: "TRANSFER",
                      walletId: sourceWalletId,
                      // categoryId is null for transfer
                  }
              }),
              // 4. Create 'Transfer In' transaction for dest
              prisma.transaction.create({
                  data: {
                      userId: user.id,
                      amount,
                      date,
                      name: transactionName || `Transfer from ${sourceName}`,
                      type: "TRANSFER",
                      walletId: destinationWalletId,
                  }
              })
          ]);
      }

      revalidatePath("/transactions");
      revalidatePath("/dashboard");
      revalidatePath("/wallets");
      revalidatePath("/budgets");

  } catch (error) {
      console.error("Failed to create transaction", error);
      throw new Error("Failed to create transaction");
  }
}

export async function deleteTransaction(id: string) {
    const user = await getCurrentUser();
    if (!user) {
        redirect("/sign-in");
    }

    try {
        const transaction = await prisma.transaction.findUnique({
            where: { id, userId: user.id },
        });

        if (!transaction) {
            throw new Error("Transaction not found");
        }

        const { type, amount, walletId } = transaction;

        // Reverse the balance change based on transaction type
        if (type === "EXPENSE") {
            await prisma.$transaction([
                prisma.wallet.update({
                    where: { id: walletId },
                    data: { balance: { increment: amount } },
                }),
                prisma.transaction.delete({ where: { id } }),
            ]);
        } else if (type === "INCOME") {
            await prisma.$transaction([
                prisma.wallet.update({
                    where: { id: walletId },
                    data: { balance: { decrement: amount } },
                }),
                prisma.transaction.delete({ where: { id } }),
            ]);
        } else if (type === "TRANSFER") {
            const isOut = transaction.name.startsWith("Transfer to");
            await prisma.$transaction([
                prisma.wallet.update({
                    where: { id: walletId },
                    data: {
                        balance: { [isOut ? "increment" : "decrement"]: amount },
                    },
                }),
                prisma.transaction.delete({ where: { id } }),
            ]);
        }

        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        revalidatePath("/wallets");
        revalidatePath("/budgets");
    } catch (error) {
        console.error("Failed to delete transaction", error);
        throw new Error("Failed to delete transaction");
    }
}

export async function updateTransaction(
    id: string,
    data: CreateTransactionInput
) {
    // Delete old transaction (reversing balance) and create new one
    await deleteTransaction(id);
    await createTransaction(data);
}
