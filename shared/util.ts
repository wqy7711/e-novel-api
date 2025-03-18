import { marshall } from "@aws-sdk/util-dynamodb";
import { ENovel } from "./types";

export const generateItem = (entity: ENovel) => {
  return {
    PutRequest: {
      Item: marshall(entity),
    },
  };
};

export const generateBatch = (data: ENovel[]) => {
  return data.map((e) => {
    return generateItem(e);
  });
};