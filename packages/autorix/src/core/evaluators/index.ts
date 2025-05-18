import { stringEvaluators } from "./stringEvaluators";
import { arrayEvaluators } from "./arrayEvaluators";
import { boolEvaluators } from "./boolEvaluators";
import { dateEvaluators } from "./dateEvaluators";
import { ipEvaluators } from "./ipEvaluators";
import { genericEvaluators } from "./genericEvaluator";
import { numericEvaluators } from "./numericEvaluators";

export {
  stringEvaluators,
  arrayEvaluators,
  boolEvaluators,
  dateEvaluators,
  ipEvaluators,
  genericEvaluators,
  numericEvaluators,
};

export const allEvaluators = {
  ...stringEvaluators,
  ...arrayEvaluators,
  ...boolEvaluators,
  ...dateEvaluators,
  ...ipEvaluators,
  ...genericEvaluators,
  ...numericEvaluators,
};
