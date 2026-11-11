export const thresholds = {
  /** PKG003: flag packages first published fewer days ago than this. */
  newPackageMaxAgeDays: 30,
  /** PKG002: names shorter than this are too collision-prone to compare. */
  typosquatMinNameLength: 5,
  /** PKG002: inside a known scope, short name parts are still comparable. */
  scopedTyposquatMinNameLength: 3,
  /** PKG002: from this length on, allow one extra edit. */
  typosquatLongNameLength: 8,
  /** PKG002: edits allowed for long names. */
  typosquatMaxDistance: 2,
} as const;
