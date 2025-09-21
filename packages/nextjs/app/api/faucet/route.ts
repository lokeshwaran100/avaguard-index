import { NextResponse } from "next/server";
import { createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import deployedContracts from "~~/contracts/deployedContracts";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const to = (body?.to as string) || "";
    const amountStr = (body?.amount as string) || "1500";

    if (!to || !to.startsWith("0x") || to.length !== 42) {
      return NextResponse.json({ success: false, error: "Invalid recipient address" }, { status: 400 });
    }

    const pk = process.env.NEXT_PUBLIC_FAUCET_PRIVATE_KEY;
    if (!pk) {
      return NextResponse.json({ success: false, error: "Server faucet key not configured" }, { status: 500 });
    }

    const account = privateKeyToAccount(pk as `0x${string}`);
    const rpcUrl = "https://api.avax-test.network/ext/bc/C/rpc";
    const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });

    const agi = deployedContracts[43113 as keyof typeof deployedContracts].AGIToken;
    const agiAddress = agi.address as `0x${string}`;
    const agiAbi = agi.abi as any;

    const amount = parseUnits(amountStr, 18);

    const txHash = await walletClient.writeContract({
      address: agiAddress,
      abi: agiAbi,
      functionName: "transfer",
      args: [to as `0x${string}`, amount],
    });

    return NextResponse.json({ success: true, txHash });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Unknown error" }, { status: 500 });
  }
}
