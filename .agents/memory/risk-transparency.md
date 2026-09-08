---
name: Risk transparency
description: How Sentinel communicates model confidence and validation metrics without overstating what an upload can support.
---

MSME Sentinel distinguishes between labeled demonstration data and real uploads without a failure label. The demo can show its calculated benchmark snapshot; an unlabeled upload uses the transparent risk scorecard and does not claim accuracy, precision, recall, F1, or ROC-AUC that were not measured.

**Why:** Risk predictions should be useful without implying certainty or inventing model performance from unlabeled business data.

**How to apply:** Keep application-defined risk bands and factor explanations visible, and preserve the distinction whenever model evaluation, reports, or future persistence work is extended.