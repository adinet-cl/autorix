/**
 * @description Define los posibles operadores de condición.
 * El uso de un enum mejora la seguridad de tipos y la legibilidad en comparación con strings literales.
 */
export enum ConditionOperator {
  STRING_EQUALS = "StringEquals",
  STRING_NOT_EQUALS = "StringNotEquals",
  STRING_LIKE = "StringLike",
  STRING_CONTAINS = "StringContains",
  STRING_STARTS_WITH = "StringStartsWith",
  STRING_ENDS_WITH = "StringEndsWith",
  STRING_INCLUDES_ANY = "StringIncludesAny",
  STRING_INCLUDES_ALL = "StringIncludesAll",
  STRING_REGEX = "StringRegex",

  BOOL = "Bool",

  NUMERIC_EQUALS = "NumericEquals",
  NUMERIC_NOT_EQUALS = "NumericNotEquals",
  NUMERIC_LESS_THAN = "NumericLessThan",
  NUMERIC_LESS_THAN_EQUALS = "NumericLessThanEquals",
  NUMERIC_GREATER_THAN = "NumericGreaterThan",
  NUMERIC_GREATER_THAN_EQUALS = "NumericGreaterThanEquals",

  ARRAY_CONTAINS = "ArrayContains",
  ARRAY_NOT_CONTAINS = "ArrayNotContains",
  ARRAY_CONTAINS_ANY = "ArrayContainsAny",
  ARRAY_EQUALS = "ArrayEquals",
  ARRAY_LENGTH_EQUALS = "ArrayLengthEquals",
  ARRAY_LENGTH_LESS_THAN = "ArrayLengthLessThan",
  ARRAY_LENGTH_GREATER_THAN = "ArrayLengthGreaterThan",

  IP_MATCH = "IpMatch",
  NOT_IP_MATCH = "NotIpMatch",
  IP_EQUALS = "IpEquals",

  DATE_EQUALS = "DateEquals",
  DATE_NOT_EQUALS = "DateNotEquals",
  DATE_LESS_THAN = "DateLessThan",
  DATE_LESS_THAN_EQUALS = "DateLessThanEquals",
  DATE_GREATER_THAN = "DateGreaterThan",
  DATE_GREATER_THAN_EQUALS = "DateGreaterThanEquals",
  DATE_IN_RANGE = "DateInRange",

  IS_NULL = "IsNull",
}
