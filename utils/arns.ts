import { getAllArns, getPrimaryArn } from "@/lib/arns";

const primaryArnCache = new Map<string, Promise<string | null>>();
const allArnsCache = new Map<string, Promise<string[]>>();

export const getPrimaryArnsName = async (
  address: string
): Promise<string | null> => {
  const key = address.trim();
  if (!primaryArnCache.has(key)) {
    primaryArnCache.set(key, getPrimaryArn(key));
  }
  return primaryArnCache.get(key)!;
};

export const getAllArnsNames = async (address: string): Promise<string[]> => {
  const key = address.trim();
  if (!allArnsCache.has(key)) {
    allArnsCache.set(key, getAllArns(key));
  }
  return allArnsCache.get(key)!;
};
