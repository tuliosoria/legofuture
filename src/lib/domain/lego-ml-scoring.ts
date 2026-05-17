/**
 * XGBoost tree-based inference for LEGO forecast models.
 *
 * Pure, side-effect-free module. Mirrors the PokeFuture `sealed-forecast-ml`
 * traversal pattern: walk each tree from root, pick child based on
 * split_condition, sum leaf contributions, add baseScore.
 *
 * The result is a raw log-return (ln of growth factor over the model horizon).
 * Callers convert to a projected price via: projectedPrice = currentPrice * Math.exp(score)
 */

import type { ForecastModel, XGBoostTree } from "@/lib/db/lego-forecast-models";

// ---------------------------------------------------------------------------
// Tree traversal
// ---------------------------------------------------------------------------

function isLeaf(node: XGBoostTree): node is XGBoostTree & { leaf: number } {
  return typeof node.leaf === "number";
}

function getChild(node: XGBoostTree, nodeId: number): XGBoostTree {
  const child = (node.children ?? []).find((c) => c.nodeid === nodeId);
  if (!child) {
    throw new Error(
      `[lego-ml-scoring] Cannot resolve child nodeid=${nodeId} from split on "${node.split}"`
    );
  }
  return child;
}

function traverseTree(
  node: XGBoostTree,
  features: Record<string, number>
): number {
  if (isLeaf(node)) {
    return node.leaf;
  }

  const featureName = node.split!;
  const rawValue = features[featureName];
  const isMissing = rawValue === undefined || !Number.isFinite(rawValue);

  let nextNodeId: number;
  if (isMissing) {
    nextNodeId = node.missing ?? node.yes ?? node.no!;
  } else {
    nextNodeId = rawValue < node.split_condition! ? node.yes! : node.no!;
  }

  return traverseTree(getChild(node, nextNodeId), features);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a ForecastModel against a feature vector.
 *
 * Returns the raw sum: baseScore + Σ(leaf value for each tree).
 *
 * For models trained with `forward_log_return` target:
 *   projectedPrice = currentPrice * Math.exp(scoreModel(model, features))
 *
 * @param model   Loaded ForecastModel (from loadForecastModel)
 * @param features  Named feature map. Missing/non-finite values are treated
 *                  as "missing" and routed via the node's `missing` child.
 */
export function scoreModel(
  model: ForecastModel,
  features: Record<string, number>
): number {
  let leafSum = 0;
  for (const tree of model.trees) {
    leafSum += traverseTree(tree, features);
  }
  return model.baseScore + leafSum;
}
