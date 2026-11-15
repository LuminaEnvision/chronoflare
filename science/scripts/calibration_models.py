"""Training-only LOYO calibration; frozen models do not inspect held-out targets."""
from bisect import bisect_right
from collections import defaultdict
from datetime import date
import math
from statistics import median

from acquisition_plan import fingerprint
from indicator_methods import empirical_ratio_interval, inverse_mae_weights, positive

ENGINE_VERSION="loyo-calibration/1.0.0"
PLATFORMS=("Terra","Aqua")
VIEWS=("Terra_only","Aqua_only","Combined_Terra_Aqua")


class TrainingBlocked(ValueError):
    """Insufficient training-only support; never an empirical holdout failure."""


def season(day):
    if date.fromisoformat(day).isoformat()!=day: raise ValueError("Noncanonical solar date")
    return "dry" if 7<=int(day[5:7])<=11 else "wet"


def quantile(values, probability):
    ordered=sorted(positive(value) for value in values)
    if not ordered or not 0<=probability<=1: raise ValueError("Invalid empirical quantile input")
    location=(len(ordered)-1)*probability
    left=int(location);right=min(left+1,len(ordered)-1)
    return ordered[left]+(ordered[right]-ordered[left])*(location-left)


def fit_candidate(rows, method):
    if not rows: raise TrainingBlocked("No positive training pairs")
    xs=[positive(r["predictor_value"]) for r in rows];ys=[positive(r["reference_value"]) for r in rows]
    if method=="median_ratio": return {"method":method,"alpha":median(y/x for x,y in zip(xs,ys))}
    if method!="empirical_quantile_mapping": raise ValueError("Unsupported calibration method")
    grouped=defaultdict(list)
    for index in range(1,100): grouped[quantile(xs,index/100)].append(quantile(ys,index/100))
    nodes=[[x,math.fsum(grouped[x])/len(grouped[x])] for x in sorted(grouped)]
    return {"method":method,"nodes":nodes,"outside_range":"clamp_to_endpoint","quantile_interpolation":"linear_type7"}


def predict_candidate(model,value):
    value=positive(value)
    if model["method"]=="median_ratio": return positive(value*model["alpha"])
    nodes=model["nodes"];xs=[row[0] for row in nodes]
    index=bisect_right(xs,value)
    if index==0:return positive(nodes[0][1])
    if index==len(nodes):return positive(nodes[-1][1])
    x0,y0=nodes[index-1];x1,y1=nodes[index]
    return positive(y0+(y1-y0)*(value-x0)/(x1-x0))


def training_floor(rows):
    dates={row["solar_date"] for row in rows}
    return len(dates)>=30 and len({day[:4] for day in dates})>=3


def select_stratum(rows, *, fallback_rows=None):
    """All candidate selection folds remain inside the supplied training set."""
    if not training_floor(rows): raise TrainingBlocked("Final stratum training floor not met")
    years=sorted({row["solar_date"][:4] for row in rows})
    candidates={method:[] for method in ("median_ratio","empirical_quantile_mapping")}
    selection_folds=[]
    for year in years:
        inner_train=[r for r in rows if r["solar_date"][:4]!=year]
        inner_test=[r for r in rows if r["solar_date"][:4]==year]
        used_fallback=False
        if not training_floor(inner_train) and fallback_rows is not None:
            inner_train=[r for r in fallback_rows if r["solar_date"][:4]!=year]
            used_fallback=True
        if not training_floor(inner_train): raise TrainingBlocked("LOYO fold training floor not met")
        selection_folds.append({"excluded_year":year,"same_platform_turn_season_fallback":used_fallback,
                                "fitting_dates":len({r["solar_date"] for r in inner_train}),"fitting_years":sorted({r["solar_date"][:4] for r in inner_train})})
        for method in candidates:
            model=fit_candidate(inner_train,method)
            candidates[method].extend({**row,"prediction":predict_candidate(model,row["predictor_value"]),"excluded_year":year} for row in inner_test)
    errors={method:math.fsum(abs(r["prediction"]-r["reference_value"]) for r in rows)/len(rows) for method,rows in candidates.items()}
    # Stable exact ties prefer the simpler ratio; holdout scores never enter selection.
    chosen=min(errors,key=lambda method:(errors[method],method!="median_ratio"))
    return {"fitted":fit_candidate(rows,chosen),"selected_method":chosen,"candidate_oof_mae":errors,
            "train_dates":sorted({r["solar_date"] for r in rows}),"selection_folds":selection_folds,"oof_rows":candidates[chosen]}


def fit_suite(training_pairs):
    rows=tuple(training_pairs)
    if not rows: raise TrainingBlocked("No training pairs")
    models={};routing={};oof={}
    for platform in PLATFORMS:
        for turn in ("D","N"):
            all_rows=[r for r in rows if r["predictor_platform"]==platform and r["day_night"]==turn]
            for name in ("dry","wet"):
                selected=[r for r in all_rows if season(r["solar_date"])==name]
                scope=name if training_floor(selected) else "all_seasons"
                key="|".join((platform,turn,scope))
                if key not in models:
                    models[key]=select_stratum(selected if scope==name else all_rows,fallback_rows=all_rows if scope==name else None)
                    for row in models[key]["oof_rows"]:
                        # If a seasonal model exists, route only its own season below.
                        oof[(platform,turn,row["solar_date"],scope)]=row["prediction"]
                routing["|".join((platform,turn,name))]=key
    return {"models":models,"routing":routing},oof


def daily_values(pairs, predict):
    by_day=defaultdict(dict);targets={}
    for row in pairs:
        day=row["solar_date"];platform=row["predictor_platform"];turn=row["day_night"]
        key=(platform,turn)
        if key in by_day[day]: raise ValueError("Duplicate daily source pair")
        by_day[day][key]=row
        target_key=(day,turn)
        if target_key in targets and targets[target_key]!=row["reference_value"]: raise ValueError("Conflicting S-NPP target")
        targets[target_key]=positive(row["reference_value"])
    result=[]
    for day,group in sorted(by_day.items()):
        if not all((day,turn) in targets for turn in ("D","N")):continue
        value={"solar_date":day,"observed":math.fsum(targets[(day,turn)] for turn in ("D","N"))}
        for platform in PLATFORMS:
            complete=all((platform,turn) in group for turn in ("D","N"))
            estimates=[predict(group[(platform,turn)]) for turn in ("D","N")] if complete else []
            value[platform]=math.fsum(estimates) if complete and all(v is not None for v in estimates) else None
            value[platform+"_native"]=math.fsum(group[(platform,turn)]["predictor_value"] for turn in ("D","N")) if complete else None
        if any(value[p] is not None for p in PLATFORMS):result.append(value)
    return result


def suite_predict(suite,row):
    route="|".join((row["predictor_platform"],row["day_night"],season(row["solar_date"])))
    return predict_candidate(suite["models"][suite["routing"][route]]["fitted"],row["predictor_value"])


def suite_oof_daily(suite,oof,pairs):
    def predict(row):
        route="|".join((row["predictor_platform"],row["day_night"],season(row["solar_date"])))
        scope=suite["routing"][route].split("|")[-1]
        return oof.get((row["predictor_platform"],row["day_night"],row["solar_date"],scope))
    return daily_values(pairs,predict)


def learn_weights(rows):
    matched=[r for r in rows if all(r[p] is not None for p in PLATFORMS)]
    if not matched:raise TrainingBlocked("No common training OOF daily cohort for weights")
    maes={p:math.fsum(abs(r[p]-r["observed"]) for r in matched)/len(matched) for p in PLATFORMS}
    return {"weights":inverse_mae_weights(maes["Terra"],maes["Aqua"]),"daily_oof_mae_same_cohort":maes,"paired_dates":[r["solar_date"] for r in matched]}


def view_value(row,view,weights):
    platforms=["Terra"] if view=="Terra_only" else ["Aqua"] if view=="Aqua_only" else [p for p in PLATFORMS if row[p] is not None]
    if not platforms or any(row[p] is None for p in platforms):return None
    if len(platforms)==1:
        platform=platforms[0]
        return {"estimated":row[platform],"naive":row[platform+"_native"],"regime":platform+"_only"}
    return {"estimated":math.fsum(weights[p]*row[p] for p in PLATFORMS),
            "naive":math.fsum(weights[p]*row[p+"_native"] for p in PLATFORMS),"regime":"Terra+Aqua_weighted"}


def fit_experiment(pairs,experiment):
    # Filter before fitting, stratification, selection, weights and residuals.
    training=sorted([r for r in pairs if r["metric"]=="frp_sum_mw" and experiment.split(r["solar_date"])=="train"],key=lambda r:(r["solar_date"],r["predictor_platform"],r["day_night"]))
    if not training:raise TrainingBlocked("No training input")
    regions={r.get("region_id") for r in training}
    if len(regions)!=1:raise ValueError("Mixed training regions")
    keys=set()
    for row in training:
        key=(row["solar_date"],row["predictor_platform"],row["day_night"])
        if key in keys or row["predictor_platform"] not in PLATFORMS or row["day_night"] not in ("D","N") or row["reference_platform"]!="S-NPP":
            raise ValueError("Unsupported or duplicated training pair")
        keys.add(key);positive(row["predictor_value"]);positive(row["reference_value"])
    years=sorted({r["solar_date"][:4] for r in training})
    # Nested LOYO: each outer year's residuals exclude it from model selection and weights.
    residuals=defaultdict(dict);outer_folds=[]
    for year in years:
        fold_train=[r for r in training if r["solar_date"][:4]!=year]
        fold_test=[r for r in training if r["solar_date"][:4]==year]
        suite,oof=fit_suite(fold_train)
        weights=learn_weights(suite_oof_daily(suite,oof,fold_train))
        heldout=daily_values(fold_test,lambda row:suite_predict(suite,row))
        for row in heldout:
            for view in VIEWS:
                predicted=view_value(row,view,weights["weights"])
                if predicted:
                    key=predicted["regime"]+"|"+season(row["solar_date"])
                    residuals[key][row["solar_date"]]=row["observed"]/predicted["estimated"]
        outer_folds.append({"excluded_year":year,"fitting_years":sorted({r["solar_date"][:4] for r in fold_train}),
                            "fold_model_sha256":fingerprint(suite),"fold_weights":weights["weights"]})
    suite,oof=fit_suite(training)
    weights=learn_weights(suite_oof_daily(suite,oof,training))
    intervals={}
    for key,values in sorted(residuals.items()):
        dates=sorted(values)
        # One residual cannot define an empirical spread. No season/regime borrowing.
        if len(dates)>=2:
            intervals[key]={"q10":quantile(list(values.values()),.1),"q90":quantile(list(values.values()),.9),"dates":dates,"count":len(dates)}
    # OOF training rows are auditable but need not bloat the frozen prediction object.
    fitted={key:{k:v for k,v in model.items() if k!="oof_rows"} for key,model in suite["models"].items()}
    return {"schema_version":ENGINE_VERSION,"train_window":[experiment.train_start,experiment.train_end],"test_window":[experiment.test_start,experiment.test_end],
            "training_pairs_sha256":fingerprint(training),"training_dates":sorted({r["solar_date"] for r in training}),"training_years":years,
            "suite":{"models":fitted,"routing":suite["routing"]},"weight_fit":weights,"intervals":intervals,"nested_outer_folds":outer_folds,
            "policy":{"candidate_tie":"median_ratio","eqm_quantiles":99,"eqm_duplicates":"mean_target_quantiles_at_identical_predictor_knot",
                      "eqm_endpoints":"clamp","weight_cohort":"same complete daily OOF dates for both platforms",
                      "naive_baseline":"uncalibrated_native_daily_values_with_identical_frozen_convex_weights",
                      "intervals":"nested_LOYO_training_residuals_by_combination_regime_and_season_no_fallback",
                      "fold_sample_floor":"same 30-date/3-year floor; recompute permitted same-platform/turn season fallback inside each selection fold; block if neither scope qualifies"},
            "harmonization_approved":False}


def predict_experiment(model,pairs,experiment):
    if model["train_window"]!=[experiment.train_start,experiment.train_end] or model["test_window"]!=[experiment.test_start,experiment.test_end]:
        raise ValueError("Frozen model experiment mismatch")
    testing=[r for r in pairs if r["metric"]=="frp_sum_mw" and experiment.split(r["solar_date"])=="test"]
    daily=daily_values(testing,lambda row:suite_predict(model["suite"],row));result={view:[] for view in VIEWS}
    for row in daily:
        for view in VIEWS:
            predicted=view_value(row,view,model["weight_fit"]["weights"])
            if not predicted:continue
            interval=model["intervals"].get(predicted["regime"]+"|"+season(row["solar_date"]))
            bounds=empirical_ratio_interval(predicted["estimated"],interval["q10"],interval["q90"]) if interval else None
            result[view].append({"solar_date":row["solar_date"],"observed":row["observed"],"estimated":predicted["estimated"],"naive":predicted["naive"],
                                 "lower":bounds["uncertainty_lower"] if bounds else None,"upper":bounds["uncertainty_upper"] if bounds else None,
                                 "regime":predicted["regime"],"complete_turn_support":True})
    return result
