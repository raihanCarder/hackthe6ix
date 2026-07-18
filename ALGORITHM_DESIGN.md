# Check-In Champions: Recommendation Engine Algorithm Design

## Status and scope

This document specifies a game-mode-independent recommendation engine for Check-In Champions. It converts live Stay22 accommodation results and short, predefined traveler answers into normalized hotel metrics, deterministic scores, Monte Carlo comparison probabilities, global rankings, regret statistics, and structured explanations.

It deliberately does **not** select a final game mode, contender count, bracket, group stage, league, squad size, card-battle rule, or visual presentation. Those product decisions remain open. Any future mode should consume this engine's outputs rather than change its recommendation mathematics.

The design distinguishes the following layers:

- **Trip constraints** determine whether a property is eligible.
- **Hotel metrics** summarize live accommodation facts on comparable 0–100 scales.
- **Traveler preference weights** are a transparent encoding of questionnaire answers.
- **Uncertainty** represents ambiguity in those preferences, not invented hotel facts.
- **Monte Carlo simulation** tests recommendations across plausible nearby weights.
- **Presentation mechanics** may visualize results but cannot alter them.
- **AI-generated text** may explain validated results but cannot select a winner.

The engine recommends the hotel. Card rarity, cosmetics, abilities, animations, seeded luck, or narrative drama must never determine the recommendation. Randomness is permitted only to model declared uncertainty or make a reproducible technical choice, never to give an arbitrary hotel an advantage.

The engine does not know true traveler satisfaction, has not learned user preferences without training labels, and does not predict booking behavior. It estimates fit under explicit product assumptions and the answers supplied in the current session.

```text
Traveler trip inputs
        |
        v
Live Stay22 accommodation results
        |
        v
Validation, deduplication, and hard filtering
        |
        v
Normalized hotel metric calculation
        |
        v
Adaptive predefined traveler questions
        |
        v
Preference points -> normalized traveler weights
        |
        v
Deterministic utility + Monte Carlo simulation
        |
        v
Pairwise probabilities + full-pool rankings + regret
        |
        v
Structured, data-grounded explanations
        |
        v
Optional AI commentary + live Stay22 booking reference
```

## 1. Inputs and hard constraints

### 1.1 Stay22 query-input classification

The classifications below are product interpretations of the available query fields, not claims that every field must appear in the UI.

| Class | Fields | Treatment |
| --- | --- | --- |
| Traveler-facing trip information | `address`, `checkin`, `checkout`, `adults`, `children`, `rooms`, `currency`, and optionally `type` | Values the traveler understands and normally supplies. `lat`/`lng` may be produced by a map selection rather than typed. |
| Hard requirements | `checkin`, `checkout`, `adults`, `children`, `rooms`; explicit `min`, `max`, `minstarrating`, `minguestrating`, `minratingcount`, and required `type` when the traveler marks them non-negotiable | Rechecked against response data where possible. Query filters reduce results but do not replace response validation. |
| Optional qualification filters | `provider`, `hotelids`, `type`, `min`, `max`, `minstarrating`, `minguestrating`, `minratingcount` | A filter is hard only when explicitly presented and accepted as a requirement. `hotelids` is primarily useful for live rehydration. |
| Geographic controls | `address`, `lat`, `lng`, `radius`, `nelat`, `nelng`, `swlat`, `swlng` | Define the destination point or allowed region. Coordinates/bounds may be derived from a map or geocoder. |
| Technical, pagination, and attribution | `pageSize`, `page`, `lang`, `aid`, `campaign`, `cluster`, `precision`, `cell` | Internal request construction. These are not traveler preferences and must never affect recommendation weights. |

`provider` can be an operator or integration choice rather than a traveler preference. `min` and `max` are request filters, not returned property prices. Their units and nightly/total semantics must be confirmed against the integration before enforcement.

### 1.2 Response validation and normalization

The current project context indicates that a result may contain: property ID, tracked Stay22 booking URL, supplier IDs, supplier links, supplier count, name, property type, address, latitude, longitude, distance, guest rating, hotel stars, review count, guest capacity, bedrooms, beds, bathrooms, free cancellation, instant booking, and thumbnail. Some may be null or absent. Actual price is not included in the confirmed field list, so value remains conditional on a verified comparable price field from the live integration.

For each response:

1. Parse fields with explicit runtime validation; reject malformed types and non-finite numbers.
2. Canonicalize identifiers, names, addresses, URLs, coordinates, booleans, and non-negative counts.
3. Preserve `unknown` separately from `false` and zero. Missing information remains missing.
4. Confirm the booking URL is a valid allowed `http`/`https` URL before exposing it.
5. Retain provenance for each normalized field and supplier offer.
6. Deduplicate before scoring.

Multiple supplier records can represent one physical property. Construct one logical accommodation entity with its supplier IDs and live supplier links when the evidence supports that merge. Duplicate detection should combine:

- exact property or supplier-ID matches;
- normalized name similarity (case folding, Unicode normalization, punctuation/legal-suffix removal);
- normalized address similarity;
- coordinate proximity, for example within a configurable 50–100 metres;
- matching capacity, beds, and bedrooms;
- identical or perceptually near-identical thumbnails as supporting, never sole, evidence.

Use a conservative rule such as an exact stable-ID match, or a high name/address match plus geographic proximity. Ambiguous pairs should be flagged rather than automatically merged. When merging, retain the most complete consistent facts; conflicting values remain supplier-scoped or unresolved, not averaged or invented.

### 1.3 Hard-filter contract

Hard constraints run before metric scoring and eliminate a property when a required fact proves it ineligible. At minimum:

- no valid required property ID;
- unavailable for the requested dates according to the live response;
- known guest capacity below `adults + children`;
- known room/bedroom availability below an explicitly required room count;
- outside the explicit radius or bounding box;
- below an explicit minimum guest rating, review count, or hotel-star rating;
- outside explicit price limits **only when an actual comparable returned price is available**;
- invalid/missing coordinates when geography is necessary to enforce a boundary;
- duplicate representation of the same physical property.

Missing data is not automatically proof of failure. The constraint must define a missing-data policy:

- **fail closed** when eligibility cannot safely be established (for example, unknown capacity for a party of six or no coordinates for a strict map boundary);
- **allow with uncertainty** when the field is useful but not essential (for example, unknown instant-booking policy);
- **not applicable** when the traveler did not impose that requirement.

All exclusion decisions should return a machine-readable reason such as `INSUFFICIENT_CAPACITY`, `OUTSIDE_BOUNDARY`, or `MISSING_REQUIRED_COORDINATES`. AI, weighted scoring, Monte Carlo variation, card rarity, cosmetic abilities, seeded randomness, or visual mechanics cannot rescue an excluded property.

## 2. Hotel metric calculation

Every active desirability metric is normalized to `[0, 100]`, with higher meaning better fit for this traveler. Each metric carries `status` (`available`, `partial`, or `unavailable`), provenance, and confidence. Clamp computed outputs to the range. Do not substitute a neutral score for missing data silently: keep the value nullable, apply the stated policy, and renormalize scoring across metrics that are valid for the comparison.

### 2.1 Quality

Raw guest ratings are noisy when review counts differ. A property rated 9.5 from 3 reviews should not automatically outrank one rated 9.0 from 3,000 reviews. Shrink each rating toward the current valid-pool mean:

```text
AdjustedRating_h = (n_h / (n_h + m)) * R_h
                 + (m / (n_h + m)) * C
```

- `R_h`: guest rating for hotel `h`.
- `n_h`: its review count.
- `C`: review-count-aware or simple mean rating among valid current candidates; choose once and test it.
- `m`: configurable confidence threshold, for example the review count at which the property and pool each receive 50% weight.

Map the adjusted value from the API's confirmed rating scale `[R_min, R_max]`:

```text
Quality_h = 100 * clamp((AdjustedRating_h - R_min) / (R_max - R_min), 0, 1)
```

Implementation rules:

- Confirm the rating scale from the response/integration; do not assume 5 or 10.
- If rating is missing, quality is unavailable. Do not infer it from stars.
- If rating exists but review count is missing, quality may be calculated using a conservative configurable pseudo-count only if clearly marked `partial`; otherwise omit it. Increase uncertainty/decrease evidence confidence.
- Very small `n_h` causes strong shrinkage toward `C`; large `n_h` approaches `R_h`.
- If too few candidates have ratings to estimate `C`, use a versioned, documented fallback prior or make quality unavailable.
- Hotel stars describe property classification/amenities, not guest satisfaction. They may be exposed as a separate optional metric or hard filter but never replace quality.

### 2.2 Location fit

When both destination and property coordinates exist, calculate great-circle distance using Haversine:

```text
a = sin^2(deltaLat / 2)
  + cos(lat1) * cos(lat2) * sin^2(deltaLng / 2)
c = 2 * atan2(sqrt(a), sqrt(1 - a))
distanceKm = earthRadiusKm * c

LocationScore_h = 100 * max(0, 1 - distanceKm_h / effectiveRadiusKm)
```

Convert degrees to radians and use a consistent Earth radius (for example, 6,371.0088 km). Determine `effectiveRadius` in this order:

1. explicit `radius`, after unit validation;
2. for a bounding box, distance from its chosen center/destination to the farthest allowed corner (the box itself remains the hard boundary);
3. for `address` or `lat`/`lng` without a radius, a versioned product default appropriate to the destination/search context;
4. if no reliable destination point or derivable radius exists, location is unavailable and no location question is asked.

An API-provided distance may be used only after confirming its origin and units; otherwise recompute. The linear decay is an MVP assumption. A later walking-time or transit-time metric requires a separate verified data source.

### 2.3 Group fit

```text
RequiredGuests = Adults + Children
GroupFit_h = 0.50 * CapacityFit_h
           + 0.30 * BedFit_h
           + 0.20 * RoomOrBedroomFit_h
```

Each component is `[0,100]`. Known capacity below `RequiredGuests` is a hard failure. For eligible properties, a practical capacity curve is:

```text
spare = capacity - RequiredGuests
CapacityFit = 100                         when spare is 0 or 1
CapacityFit = max(60, 100 - 10*(spare-1)) when spare > 1
```

This rewards an exact/slightly roomy fit and mildly penalizes excessive unused capacity without assuming it is bad. Component policies:

- `BedFit`: 100 when known beds meet a derived or explicitly requested need; decay by a configurable amount per missing bed. Never infer sleeping arrangements from capacity alone.
- `RoomOrBedroomFit`: compare `rooms` with known bedrooms/rooms only after mapping response semantics. An explicit unmet room requirement is a hard failure.
- If a non-hard component is missing, omit that component and renormalize the known component weights. Mark the metric partial.
- If capacity is missing, use fail-closed for larger parties or explicit capacity requirements. A product-configured solo/couple policy may allow it with partial confidence, but must be disclosed.

Party context changes questions and desired configuration, not facts. Families may value room/bed separation; friend groups may require more beds; couples and solo travelers usually need less configuration emphasis. Children count toward required capacity. Bathrooms are a useful optional component for larger groups only when coverage and variation justify it; adding it requires renormalizing the documented component weights.

### 2.4 Flexibility

```text
Flexibility_h = 0.50 * CancellationScore_h
              + 0.20 * InstantBookScore_h
              + 0.30 * SupplierAvailabilityScore_h
```

- `CancellationScore`: 100 for verified free cancellation, 0 for verified no free cancellation, unavailable when unknown. If deadlines/terms become available, use a documented graduated scale rather than treating all policies alike.
- `InstantBookScore`: 100 when verified true, 0 when verified false, unavailable when unknown.
- `SupplierAvailabilityScore`: a saturating score, for example `100 * min(1, log1p(count) / log1p(S_supplier))`, where `S_supplier` is the versioned count considered fully saturated.

Renormalize component weights over known values and mark partial coverage. Multiple suppliers mean more booking choices; they do not guarantee a lower price, availability, identical terms, or quality.

### 2.5 Data confidence

Data confidence measures evidence completeness, **not** hotel desirability:

```text
DataConfidence_h = 100 * (
    0.30 * RatingPresent
  + 0.20 * ReviewCountPresent
  + 0.20 * CapacityPresent
  + 0.10 * BedsAndBedroomsPresent
  + 0.10 * PoliciesPresent
  + 0.10 * SupplierDataPresent
)
```

Indicators are in `[0,1]`; composite indicators can be fractional (for example one of beds/bedrooms present = 0.5). Schema validity and conflicting supplier facts should reduce the relevant indicator. Confidence affects disclosure, uncertainty diagnostics, safe-alternative selection, and deterministic tie handling. It is included as a preference metric only at a modest user-visible weight; it must not overwhelm quality, location, or fit merely because a listing has more fields.

### 2.6 Value (conditional)

Value is active only if prices are actual, comparable live prices for the same dates, party, room count, currency, and price basis (nightly versus full stay, including consistent taxes/fees treatment). Query `min`/`max` values are filters, not property prices.

For a lower-is-better comparable property price `P_h`:

```text
PriceScore_h = 100 * (P_max - P_h) / (P_max - P_min)
Value_h = lambda * PriceScore_h + (1 - lambda) * Quality_h
```

`lambda` is a versioned product choice, for example 0.60. If all prices are identical, set `PriceScore` to 100 for all (no property is disadvantaged) and report zero price variation. Never convert currencies without a time-stamped exchange-rate source. Never mix nightly and total prices.

Activate value only when coverage exceeds a configured threshold and comparisons remain fair. With partial price coverage, either restrict the comparison pool to comparably priced properties or omit value for the whole run; do not give missing-price hotels a fabricated median. If value is unavailable, remove it, suppress price questions, and renormalize the remaining weights.

### 2.7 Availability and variation analysis

For every metric compute:

- eligible-property coverage;
- `available`/`partial`/`unavailable` status;
- dispersion such as interquartile range, median absolute deviation, and range;
- count of distinct meaningful values for booleans/categorical components;
- confidence distribution.

A metric is questionnaire-eligible only when coverage and variation exceed versioned thresholds. Thresholds are MVP product assumptions and should be tested with live response samples.

## 3. Adaptive predefined questionnaire

The default flow asks approximately three to five quick questions selected from an approved bank. Selection depends on trip inputs, party size, available metrics, meaningful candidate variation, and previous answers. Free text is optional and secondary.

```typescript
type Metric =
  | "quality"
  | "location"
  | "groupFit"
  | "flexibility"
  | "dataConfidence"
  | "value";

interface AnswerOption {
  id: string;
  label: string;
  effects: Partial<Record<Metric, number>>;
  flags?: Array<"allow_hidden_gem" | "broaden_diversity" | "lower_certainty">;
}

interface QuestionCondition {
  requiredMetrics?: Metric[];
  minimumCoverage?: Partial<Record<Metric, number>>;
  minimumVariation?: Partial<Record<Metric, number>>;
  minimumPartySize?: number;
  maximumPartySize?: number;
  previousAnswers?: Record<string, string[]>;
}

interface PreferenceQuestion {
  id: string;
  text: string;
  type: "single_select" | "multi_select";
  options: AnswerOption[];
  condition?: QuestionCondition;
}

interface TravelerAnswer {
  questionId: string;
  optionIds: string[];
}
```

Suggested bank:

1. **Primary priority — “What matters most for this trip?”**
   - Best location: location +30, quality +5.
   - Best reviews: quality +30, data confidence +10.
   - Enough space: group fit +35.
   - Flexible booking: flexibility +35.
   - Best value: value +30, quality +5; show only when value is active.
   - Balanced overall: quality/location/group fit/flexibility +10 each, data confidence +5.
2. **Trip type — “What kind of trip is this?”**
   - Event/concert: location +20, quality +5, flexibility +5.
   - Family: group fit +20, flexibility +10, quality +5.
   - Friends: group fit +15, location +10, value +5 if active.
   - Business: location +15, quality +10, flexibility +5.
   - Couple getaway: quality +15, location +10, flexibility +5.
   - Solo: location +10, quality +10, value +10 if active.
3. **Plan flexibility — “How fixed are your plans?”** Show only when flexibility varies.
   - Plans may change: flexibility +25.
   - Some flexibility helps: flexibility +15.
   - Dates fixed: flexibility +5.
   - Cancellation does not matter: +0.
4. **Adaptive trade-off**, based on primary priority:
   - Location: “Would you accept lower reviews to stay closer?” Much more: location +20; small difference: location +10, quality +10; no: quality +20.
   - Quality: “Would you stay farther away for better reviews?” Yes: quality +20; slightly: quality +10, location +10; no: location +20.
   - Value: “Would you pay more for much better reviews?” No: value +20; a little: value +10, quality +10; yes: quality +20.
   - Space: “Would you stay farther away for more space?” Yes: group fit +20; slightly: group fit +10, location +10; no: location +20.
5. **Recommendation style — “What kind of recommendation do you prefer?”**
   - Safe and reliable: data confidence +25, quality +10.
   - Balanced: quality/location/group fit/flexibility +5 each.
   - Hidden gem: quality +10, data confidence +5, `allow_hidden_gem`.
   - Surprise me: `broaden_diversity` and `lower_certainty`; no arbitrary scoring bonus.

Point effects are transparent **MVP design choices**, not learned preferences. A hidden-gem or surprise flag may widen which properties are shown or reduce the Dirichlet concentration, but cannot fabricate strengths or randomly determine the winner.

Skip a question when its dimension cannot change the result: no comparable prices means no value question; identical policies mean no flexibility question; negligible distance variation means no location trade-off; a solo traveler normally receives fewer space questions. Deterministic branching should be the MVP default. Log the bank version, eligible-question reasons, and skipped-question reasons.

## 4. Converting answers into weights

Start every active metric with configurable baseline points (default 10), add all selected option effects, then normalize:

```text
points_j = baseline_j + sum(answerEffect_ij)
w_j = points_j / sum_k(points_k)
```

Remove unavailable metrics before normalization. Reject negative or non-finite points. These weights are a current-session representation of answers, not universal preferences.

### Numerical example

Assume all six metrics are available. Baselines contribute 10 each. The traveler chooses Best location (`location +30`, `quality +5`), Event/concert (`location +20`, `quality +5`, `flexibility +5`), Plans may change (`flexibility +25`), a balanced location/quality trade-off (`location +10`, `quality +10`), and Safe and reliable (`dataConfidence +25`, `quality +10`).

| Metric | Baseline | Answer additions | Points | Weight |
| --- | ---: | ---: | ---: | ---: |
| Quality | 10 | 5 + 5 + 10 + 10 | 40 | 19.51% |
| Location | 10 | 30 + 20 + 10 | 70 | 34.15% |
| Group fit | 10 | 0 | 10 | 4.88% |
| Flexibility | 10 | 5 + 25 | 40 | 19.51% |
| Data confidence | 10 | 25 | 35 | 17.07% |
| Value | 10 | 0 | 10 | 4.88% |

The raw total is 205 points. Implementations must compute rather than hand-round weights and may adjust the last displayed value by the rounding remainder.

### Deterministic fallbacks

If questions are skipped, offer named, versioned profiles (percentages):

| Profile | Quality | Location | Group fit | Flexibility | Data confidence | Value |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Best overall | 35 | 30 | 20 | 10 | 5 | — |
| Closest | 20 | 55 | 10 | 10 | 5 | — |
| Family/group | 20 | 20 | 45 | 10 | 5 | — |
| Best reviewed | 55 | 20 | 10 | 5 | 10 | — |
| Flexible/low risk | 20 | 15 | 10 | 40 | 15 | — |
| Best value (price required) | 20 | 15 | 10 | 5 | 5 | 45 |

If a profile metric is unavailable, remove it and proportionally renormalize. These are product defaults, not learned weights.

## 5. Deterministic utility score

For hotel `h`, active metrics `j`, weights `w_j`, and normalized values `x_hj`:

```text
Score_h = sum_j(w_j * x_hj)
```

This is one exact interpretation of the traveler's preferences. Use it for a deterministic baseline, sorting, explanations, and fallback when simulation is unavailable.

Example with active weights quality 0.40, location 0.35, group fit 0.15, flexibility 0.10:

| Hotel | Quality | Location | Group fit | Flexibility | Score |
| --- | ---: | ---: | ---: | ---: | ---: |
| Harbour House | 88 | 65 | 100 | 70 | `35.2 + 22.75 + 15 + 7 = 79.95` |
| Metro Lodge | 80 | 92 | 75 | 85 | `32 + 32.2 + 11.25 + 8.5 = 83.95` |

Metro Lodge wins the deterministic comparison because its location and flexibility advantages outweigh Harbour House's quality and group-fit advantages. This does not establish universal superiority.

For partial per-hotel metrics, prefer excluding a metric pool-wide if coverage is poor. If sparse omissions remain, calculate over comparable active metrics and surface reduced confidence; do not silently impute 50.

## 6. Monte Carlo simulation

Monte Carlo repeats the evaluation thousands of times while slightly varying uncertain traveler preferences. It measures how often each hotel wins or ranks first under plausible interpretations near the questionnaire answer. It must not randomly invent or perturb hotel attributes in the MVP.

For simulation `s`:

```text
U_h^(s) = sum_j(w_j^(s) * x_hj)
```

Sample weights from a Dirichlet distribution centered on base weights:

```python
base_weights = np.array([0.35, 0.30, 0.20, 0.10, 0.05])
concentration = 40
alpha = np.maximum(base_weights * concentration, 1e-9)
sampled_weights = rng.dirichlet(alpha, size=simulation_count)
```

Larger concentration values keep samples near the stated weights; smaller values represent more ambiguity. Use 30–50 for the MVP. Consistent multiple answers can use the upper end; contradictory answers or “Surprise me” can use the lower end. Record the rule and value. Zero-weight metrics should be excluded before sampling rather than assigned an epsilon that unintentionally activates them.

This is not a neural network, learned personalization, or forecast of satisfaction/booking. Softmax is unnecessary as the main decision mechanism; simulated win/rank frequency is already the probability-like output.

## 7. Pairwise comparison

Compare any two eligible hotels on the same ordered active-metric vector:

1. Draw a traveler-weight matrix using the run's seed.
2. Multiply each sampled vector by both metric vectors.
3. Record `A`, `B`, or a numerical tie for each simulation.
4. Aggregate win and tie frequencies, mean utilities, and contribution differences.

```python
weights = rng.dirichlet(alpha, size=5000)
scores_a = weights @ hotel_a_metrics
scores_b = weights @ hotel_b_metrics
epsilon = 1e-9

probability_a = float(np.mean(scores_a > scores_b + epsilon))
probability_b = float(np.mean(scores_b > scores_a + epsilon))
tie_probability = 1.0 - probability_a - probability_b
```

A display-level “too close to call” status may be declared when neither hotel exceeds a configurable threshold such as 0.55, but retain the underlying probabilities. Return IDs, both deterministic scores, win/tie probabilities, mean utilities, data-confidence context, main contributions, seed/config version, and simulation count. Do not force probabilities to sum to one by discarding actual ties.

## 8. Full candidate ranking

Evaluate every valid hotel simultaneously so any future product mode can consume a single coherent ranking:

```python
# weights: simulations x metrics
# hotel_matrix: hotels x metrics
utilities = weights @ hotel_matrix.T
winner_indices = np.argmax(utilities, axis=1)
ranks = rank_descending_per_row(utilities, stable_hotel_id_tiebreak=True)
```

For each simulation, use the same sampled weight vector for all hotels. Record each hotel's utility, rank, and whether it ranks first or in the top three. Aggregate:

- probability of ranking first;
- average and median rank;
- top-three probability (or `topK` for small pools);
- average utility and utility quantiles;
- deterministic score/rank;
- recommendation stability.

Define recommendation stability transparently, for example the leading hotel's first-place probability plus the gap to the runner-up, reported as separate numbers rather than an opaque label. Stable ID ordering is only a reproducible exact-tie mechanism; tie incidence should still be reported.

Pairwise probability and first-place probability answer different questions. A hotel can compare well head-to-head yet rarely rank first in a large pool. Do not manufacture a pairwise matrix when it is not requested; if produced, reuse the same simulation weights for consistency.

## 9. Regret and robustness

For hotel `h` in simulation `s`:

```text
Regret_h^(s) = max_k(U_k^(s)) - U_h^(s)
```

Calculate average regret, maximum observed regret, 95th-percentile regret, first-place probability, top-three probability, and utility distribution. These enable distinct, clearly labeled outputs:

- **Most likely best:** highest first-place probability.
- **Safest low-regret:** lowest 95th-percentile regret (then average regret).
- **Highest-confidence:** strongest data confidence among competitively scoring properties; not automatically the recommendation.

The safest alternative should normally exclude the primary recommendation and remain close enough on deterministic score or first-place probability to be meaningful. Maximum observed regret depends on simulation count and should not be described as a theoretical worst case.

## 10. Explainability

At mean/base weight, metric contribution is:

```text
Contribution_hj = meanWeight_j * metricScore_hj
Delta_j(A,B) = Contribution_Aj - Contribution_Bj
```

Sort positive deltas for the winner's advantages and negative deltas for the opponent's advantages. Include raw metric values, weights, contribution values, missing-data notes, and confidence so the explanation is auditable.

```json
{
  "winnerId": "hotel_a",
  "winProbability": 0.68,
  "tieStatus": "clear",
  "mainAdvantages": [
    { "metric": "location", "difference": 8.6 },
    { "metric": "groupFit", "difference": 6.3 }
  ],
  "opponentAdvantages": [
    { "metric": "quality", "difference": 2.3 }
  ],
  "caveats": ["Hotel A's cancellation policy was unavailable."]
}
```

Future visuals may map verified differences to labels: location → “Home Advantage,” rating/review evidence → “Veteran Form,” capacity/configuration → “Squad Depth,” free cancellation → “Cancellation Shield,” supplier availability → “Transfer Market,” and instant booking → “First-Touch Finish.” These are presentation labels only and cannot modify utilities or probabilities.

Ranking explanations should state why the leader ranks first, its first-place stability, the closest trade-off, missing-data caveats, and why the safest alternative differs. Avoid causal language such as “will make you happier.”

## 11. AI integration

AI may:

- optionally translate free-text preferences into supported metrics and weights;
- choose the next question **from the approved eligible bank**;
- summarize why validated weights were assigned;
- render structured comparisons/rankings as commentary;
- explain how a hotel fits the supplied answers.

AI must not invent fields, price, policies, capacity, or availability; override constraints; calculate unvalidated scores; choose a winner; replace Monte Carlo; or change rules between comparisons.

Use deterministic question branching for the MVP. Optional natural-language mode should return strict structured output:

```typescript
interface AIPreferenceOutput {
  profile: string;
  activeMetrics: Metric[];
  weights: Partial<Record<Metric, number>>;
  reasoningSummary: string[];
}
```

Validate that keys are supported and available, all values are finite and within `[0,1]`, and the sum is within a small tolerance of 1. Remove unavailable metrics only through deterministic validation and renormalize. Hard constraints remain immutable. On any failure, use a named deterministic fallback. Commentary generation receives structured facts only; output should be checked for unsupported numeric/property claims before display.

## 12. Reusable engine outputs

The engine returns a versioned result independent of UI/game format:

- cleaned logical accommodations and exclusion reasons;
- normalized metrics, availability, provenance, and confidence;
- questionnaire version, displayed/skipped questions, and answers;
- preference points and normalized weights;
- deterministic scores and ranks;
- requested pairwise comparison probabilities;
- full-pool first-place, average-rank, median-rank, and top-three statistics;
- regret/robustness statistics;
- structured comparison and ranking explanations;
- simulation configuration and reproducibility seed;
- live property ID, tracked Stay22 booking URL, and supplier references without fabricating or freezing listing facts.

No output prescribes a bracket, group, squad, card battle, or contender count.

## 13. Performance

Use 1,000 simulations during development, 5,000 for the demo, and 10,000 only if stability analysis shows value. Matrix multiplication over a few dozen hotels, metrics, and 5,000 samples is computationally small on a modern CPU, but exact runtime must be benchmarked in this repository before making latency claims.

Vectorize weight sampling, pairwise scoring, global utilities, ranks, and regret. Generate one global simulation matrix per run and reuse it for comparisons. Likely bottlenecks are Stay22 API latency, optional LLM calls, image loading, and UI animation. Cache only in ways allowed by Stay22 terms; `IDEA.md` notes that listing data should be used live rather than hard/cold-stored.

## 14. Reproducibility

Build a canonical payload from:

- normalized search parameters (excluding secrets and non-semantic pagination order);
- sorted logical property IDs plus a hash/version of the live normalized facts used;
- ordered questionnaire IDs and answers;
- active metrics and scoring/configuration versions;
- simulation count and concentration.

Hash the canonical serialization to a seeded PRNG input. The same live hotel facts, answers, and configuration must reproduce the same scores and samples. A changed Stay22 result is a new input and may legitimately change the recommendation. Store/return the seed and all algorithm version identifiers. Never include API keys in seeds, logs, or client payloads.

## 15. Suggested interfaces and functions

These interfaces intentionally model only fields confirmed by current project context. A price field must not be added until the actual integration schema is verified.

```typescript
type Metric = "quality" | "location" | "groupFit" |
  "flexibility" | "dataConfidence" | "value";
type MetricStatus = "available" | "partial" | "unavailable";

interface RawStay22Accommodation {
  id?: unknown;
  bookingUrl?: unknown;
  supplierIds?: unknown;
  supplierLinks?: unknown;
  supplierCount?: unknown;
  name?: unknown;
  type?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
  distance?: unknown;
  guestRating?: unknown;
  stars?: unknown;
  reviewCount?: unknown;
  capacity?: unknown;
  bedrooms?: unknown;
  beds?: unknown;
  bathrooms?: unknown;
  freeCancellation?: unknown;
  instantBooking?: unknown;
  thumbnail?: unknown;
}

interface NormalizedAccommodation {
  id: string;
  bookingUrl: string | null;
  supplierIds: string[];
  supplierLinks: string[];
  supplierCount: number | null;
  name: string | null;
  propertyType: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  guestRating: number | null;
  stars: number | null;
  reviewCount: number | null;
  capacity: number | null;
  bedrooms: number | null;
  beds: number | null;
  bathrooms: number | null;
  freeCancellation: boolean | null;
  instantBooking: boolean | null;
  thumbnailUrl: string | null;
  provenance: Record<string, string[]>;
}

interface MetricValue {
  value: number | null;
  status: MetricStatus;
  confidence: number;
  notes: string[];
}
type HotelMetrics = Record<Metric, MetricValue>;

interface MetricAvailability {
  metric: Metric;
  status: MetricStatus;
  coverage: number;
  variation: number;
  reason?: string;
}

interface AnswerOption {
  id: string;
  label: string;
  effects: Partial<Record<Metric, number>>;
}
interface QuestionCondition {
  requiredMetrics?: Metric[];
  minimumCoverage?: Partial<Record<Metric, number>>;
  minimumVariation?: Partial<Record<Metric, number>>;
  minimumPartySize?: number;
  maximumPartySize?: number;
  previousAnswers?: Record<string, string[]>;
}
interface PreferenceQuestion {
  id: string;
  text: string;
  type: "single_select" | "multi_select";
  options: AnswerOption[];
  condition?: QuestionCondition;
}
interface TravelerAnswers { answers: TravelerAnswer[]; }
type PreferencePoints = Partial<Record<Metric, number>>;
type NormalizedWeights = Partial<Record<Metric, number>>;

interface SimulationConfig {
  count: number;
  concentration: number;
  seed: string;
  algorithmVersion: string;
}
interface PairwiseComparisonResult {
  hotelAId: string;
  hotelBId: string;
  probabilityA: number;
  probabilityB: number;
  tieProbability: number;
  deterministicScores: [number, number];
  meanUtilities: [number, number];
  confidence: number;
  explanation: ComparisonExplanation;
}
interface HotelRankStats {
  hotelId: string;
  deterministicScore: number;
  firstPlaceProbability: number;
  topThreeProbability: number;
  averageRank: number;
  medianRank: number;
  averageUtility: number;
}
interface GlobalRankingResult {
  hotels: HotelRankStats[];
  stabilityGap: number;
  config: SimulationConfig;
}
interface RegretResult {
  hotelId: string;
  average: number;
  maximumObserved: number;
  percentile95: number;
}
interface MetricContribution {
  metric: Metric;
  winnerValue: number;
  opponentValue: number;
  weight: number;
  difference: number;
}
interface ComparisonExplanation {
  winnerId: string | null;
  mainAdvantages: MetricContribution[];
  opponentAdvantages: MetricContribution[];
  caveats: string[];
}
interface RankingExplanation {
  leaderId: string;
  mainReasons: MetricContribution[];
  stability: { firstPlaceProbability: number; gap: number };
  safestAlternativeId: string | null;
  caveats: string[];
}
```

Suggested pure or narrowly scoped functions:

```typescript
normalizeStay22Property(raw): NormalizedAccommodation
detectDuplicates(hotels): DuplicateCluster[]
applyHardConstraints(hotels, trip): EligibilityResult
calculateQualityScore(hotel, pool, config): MetricValue
calculateLocationScore(hotel, trip, config): MetricValue
calculateGroupFitScore(hotel, trip, config): MetricValue
calculateFlexibilityScore(hotel, config): MetricValue
calculateDataConfidence(hotel): MetricValue
calculateValueScore(hotel, comparablePrices, config): MetricValue
analyzeMetricAvailability(metrics): MetricAvailability[]
calculateMetricVariation(values, config): number
selectAdaptiveQuestions(context, bank): PreferenceQuestion[]
applyAnswerEffects(baselines, answers, bank): PreferencePoints
normalizePreferencePoints(points, availability): NormalizedWeights
validatePreferenceWeights(weights, availability): ValidationResult
calculateBaseScore(metrics, weights): number
simulatePairwiseMatchup(a, b, weights, config): PairwiseComparisonResult
simulateCandidateRanking(hotels, weights, config): GlobalRankingResult
calculateRegret(utilities): RegretResult[]
buildComparisonExplanation(result, metrics, weights): ComparisonExplanation
buildRankingExplanation(ranking, regret, metrics, weights): RankingExplanation
generateAICommentary(explanation): string
```

## 16. Recommended MVP algorithm

The minimum reusable implementation is:

1. Accept traveler-facing trip inputs and explicit hard requirements.
2. Fetch live Stay22 results server-side with attribution parameters.
3. Runtime-validate, normalize, and conservatively deduplicate results.
4. Apply hard constraints with explicit missing-data policies and exclusion reasons.
5. Calculate quality, location, group-fit, flexibility, and data-confidence metrics.
6. Activate value only if verified comparable live prices exist.
7. Analyze metric coverage and variation.
8. Select three to five eligible predefined questions deterministically.
9. Convert answers to versioned points and normalized weights; use a named fallback if skipped/invalid.
10. Calculate deterministic utility scores for every valid hotel.
11. Generate 5,000 seeded Dirichlet weight samples centered on those weights.
12. Produce pairwise probabilities on demand and a full-pool ranking distribution.
13. Calculate first-place/top-three probability, rank summaries, and regret.
14. Build structured, auditable explanations and caveats.
15. Optionally render validated AI commentary.
16. Return live property/booking references with the recommendation outputs.

No final game format is part of this MVP algorithm.

## 17. Future game-mode integration

The same immutable engine result can support a direct two-hotel comparison, top-hotel recommendation, card matchup, squad matchup, knockout bracket, group-stage tournament, league table, or another format. A mode may choose which eligible hotels to display and how to animate already-computed evidence. It must not alter metrics, weights, constraints, probabilities, or winners for dramatic effect. This document intentionally chooses none of these modes.

## 18. Testing plan

### Unit tests

- Bayesian rating shrinkage at zero/small/large review counts and missing rating/count.
- Haversine distance, unit conversion, radius boundary, and missing coordinates.
- insufficient capacity and explicit room requirement failures.
- null/unknown preservation and fail-open/fail-closed policies.
- exact duplicates, likely near-duplicates, false positives, and conflicting supplier facts.
- metric coverage/variation and question-condition eligibility.
- predefined answer effects, baseline points, normalization, rounding, and unavailable-metric removal.
- every deterministic fallback profile and profile renormalization.
- value omitted without actual comparable prices; identical and mixed-basis prices.
- fixed-seed Monte Carlo reproducibility and changed-seed distribution sanity.
- pairwise symmetry (`P(A)+P(B)+P(tie)=1`) and identical-hotel ties.
- full-ranking first-place probabilities, ranks, and stable exact ties.
- regret equals best utility minus hotel utility; percentile calculation.
- explanation contribution sums and signs.
- invalid AI schema/weights fall back deterministically.

### Integration tests

- representative Stay22 response -> normalized/deduplicated eligible list with exclusion reasons.
- candidate metrics/variation -> correct adaptive questionnaire and skipped reasons.
- questionnaire answers -> valid points and weights summing to one.
- weights -> deterministic scores, pairwise comparison, and global Monte Carlo ranking.
- ranking/regret -> structured explanation with only supported facts.
- identical inputs/config/live facts -> identical seed and outputs.
- property IDs and tracked booking links survive the pipeline without API-key leakage.

### Worked end-to-end example (fictional data)

These hotels and numbers are synthetic test fixtures, not Stay22 claims. Assume two adults, one child, one room; all pass hard constraints. Actual comparable prices are unavailable, so value is omitted.

| Hotel | Quality | Location | Group fit | Flexibility | Data confidence |
| --- | ---: | ---: | ---: | ---: | ---: |
| Harbour House | 90 | 62 | 100 | 70 | 92 |
| Metro Lodge | 82 | 94 | 78 | 88 | 96 |
| Garden Suites | 86 | 76 | 94 | 55 | 84 |
| Old Town Inn | 88 | 85 | 70 | 45 | 98 |

Availability analysis finds meaningful variation in every shown metric. The engine asks:

- “What matters most?” → Best location (`location +30`, `quality +5`).
- “What kind of trip?” → Family (`groupFit +20`, `flexibility +10`, `quality +5`).
- “How fixed are your plans?” → Some flexibility (`flexibility +15`).
- “Accept lower reviews to stay closer?” → Only a small difference (`location +10`, `quality +10`).
- “Recommendation style?” → Safe and reliable (`dataConfidence +25`, `quality +10`).

With baseline 10 per active metric, points and weights are:

| Metric | Points | Weight |
| --- | ---: | ---: |
| Quality | 40 | 21.05% |
| Location | 50 | 26.32% |
| Group fit | 30 | 15.79% |
| Flexibility | 35 | 18.42% |
| Data confidence | 35 | 18.42% |

The point total is 190. Unrounded weights are used in all calculations; percentages are rounded for display.

The resulting deterministic scores are:

| Hotel | Calculation (rounded) | Score |
| --- | --- | ---: |
| Harbour House | `.2105*90 + .2632*62 + .1579*100 + .1842*70 + .1842*92` | 80.89 |
| Metro Lodge | `.2105*82 + .2632*94 + .1579*78 + .1842*88 + .1842*96` | 88.21 |
| Garden Suites | `.2105*86 + .2632*76 + .1579*94 + .1842*55 + .1842*84` | 78.55 |
| Old Town Inn | `.2105*88 + .2632*85 + .1579*70 + .1842*45 + .1842*98` | 78.29 |

Metro Lodge leads because location, flexibility, and confidence outweigh its lower group fit and quality. A 5,000-simulation seeded run with concentration 40 would then produce empirical pairwise and global-rank statistics; exact probabilities must be generated by the implementation, not invented in this design. A valid fixture assertion might require Metro Lodge's first-place probability to be highest for the fixed library/seed, while snapshotting the exact computed output. The explanation should mention its location and flexibility advantages, Harbour House's quality/group-fit advantages, and that price played no role.

## Assumptions made

- The response fields listed in the project brief are the only accommodation facts relied upon; each may be missing.
- Stay22 results represent live consumer-facing inventory and tracked booking references; long-term storage behavior remains governed by the Stay22 agreement noted in `IDEA.md`.
- Rating scale, radius units, price schema, availability semantics, and room-field semantics will be verified in the actual integration before implementation.
- Metric coefficients, questionnaire points, variation thresholds, default radii, confidence threshold `m`, supplier saturation, and Dirichlet concentration are versioned MVP product assumptions, not learned parameters.
- The MVP varies traveler weights only; hotel metrics remain fixed.

## Data limitations

- The confirmed response-field list does not include a price field, so value may be unavailable.
- Missing/null fields reduce eligibility, metric availability, or confidence; they are never fabricated.
- Supplier records may duplicate one physical property or contain conflicting facts.
- Coordinates measure geometric distance, not travel time, safety, neighborhood quality, or accessibility.
- Review ratings are observational and imperfect; Bayesian shrinkage improves evidence handling but does not remove bias.
- Policy booleans lack nuance unless deadlines and terms are available.
- Monte Carlo quantifies sensitivity to modeled preferences, not real-world satisfaction or booking probability.

## Unresolved product decisions

- Whether the final experience is a two-hotel comparison, three-card squad, eight/sixteen/another contender count, knockout bracket, group stage, league, or another card-based mode.
- Whether the tournament direction replaces or coexists with the pack-opening, collection, and three-card mode in `IDEA.md`.
- Whether actual comparable price data is consistently available and how taxes/fees and nightly/total bases are represented.
- Exact default radius, hard-filter missing-data policies, duplicate thresholds, and metric-availability/variation thresholds.
- Whether travelers answer before or after an initial live fetch; this design recommends trip inputs -> fetch -> adaptive questions so questions reflect available variation.
- How often live Stay22 facts and booking links are refreshed and what reference-only data may be persisted.
- Whether a user can revise answers after seeing results and whether that creates a new reproducible run.

## Recommended reusable algorithm

Fetch live results, validate and deduplicate them, enforce hard requirements, compute only evidence-supported 0–100 metrics, ask three to five eligible predefined questions, convert explicit point effects into normalized weights, calculate deterministic utilities, sample 5,000 nearby weight vectors with a seeded Dirichlet distribution, rank the full pool and compare pairs, quantify regret/stability, and produce structured explanations plus live booking references. Keep all visual and future game-mode mechanics downstream of—and unable to modify—these outputs.
