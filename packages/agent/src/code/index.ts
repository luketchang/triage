import { exec } from "child_process";

import { logger } from "@triage/common";

import { CatRequest, CatRequestResult, GrepRequest, GrepRequestResult } from "../types";

export async function handleCatRequest(toolCall: CatRequest): Promise<CatRequestResult> {
  return new Promise((resolve, reject) => {
    exec(`cat ${toolCall.path}`, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Error reading file ${toolCall.path}: ${error} \n ${stderr}`);
        reject(error);
      } else {
        resolve({ content: stdout, type: "catRequestResult" });
      }
    });
  });
}

export async function handleGrepRequest(toolCall: GrepRequest): Promise<GrepRequestResult> {
  return new Promise((resolve, reject) => {
    exec(
      `grep ${toolCall.flags ? `-${toolCall.flags}` : ""} ${toolCall.pattern} ${toolCall.file}`,
      (error, stdout, stderr) => {
        // grep returns exit code 1 if no matches are found, but that's not an error for our use case.
        // error.code === 1 means "no matches"
        if (error && typeof error.code === "number" && error.code !== 1) {
          logger.error(`Error grepping file ${toolCall.file}: ${error} \n ${stderr}`);
          reject(error);
        } else {
          // If error.code === 1, stdout will be empty (no matches), which is fine.
          resolve({ content: "No matches found", type: "grepRequestResult" });
        }
      }
    );
  });
}
