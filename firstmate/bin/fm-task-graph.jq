# Project an fm-fleet-snapshot.v1 value into the public fm-task-graph.v1 model.
# This filter intentionally drops paths, endpoint identifiers, raw status, and prose bodies.
def nonempty: type == "string" and length > 0;
def notice($id; $reason): {taskId:$id, reason:$reason};
def runtime_for($fleet; $id): first($fleet.tasks[]? | select(.id == $id)) // null;
def backlog_state: if . == "queued" then "queued" elif . == "in_flight" then "in_flight" elif . == "done" then "done" else "unknown" end;
def runtime_state($r): if $r == null then "unknown" else ($r.current_state.state // "unknown") end;
def phase($b; $r):
  (runtime_state($r)) as $s
  | if $b.state == "done" then "completed"
    elif $s == "failed" then "failed"
    elif $s == "done" then "completed"
    elif ($r.hints.pending_decision // false) then "awaiting_decision"
    elif (($b.unresolved_blocker_ids // []) | length) > 0 then "awaiting_dependency"
    elif $s == "working" then "executing"
    elif ($s == "parked" or $s == "blocked" or $s == "paused") then "failed"
    elif $b.state == "in_flight" then "dispatched"
    elif $b.state == "queued" then "ready"
    else "unknown" end;
def wait($b; $r):
  if (($b.unresolved_blocker_ids // []) | length) > 0 then
    {kind:"dependency", reason:($b.blocked_reason // "Waiting for dependencies"), blockerIds:$b.unresolved_blocker_ids, since:null, actionableBy:"external"}
  elif ($r != null and ($r.hints.pending_decision // false)) then
    {kind:"captain_decision", reason:((first($r.hints.open_decisions[]? | select(.verb == "needs-decision") | .summary)) // "Captain decision required"), blockerIds:[], since:null, actionableBy:"captain"}
  elif ($b.hold_reason // null) != null then
    {kind:(if $b.hold_kind == "captain" then "captain_decision" else "external" end), reason:$b.hold_reason, blockerIds:[], since:null, actionableBy:(if $b.hold_kind == "captain" then "captain" else "external" end)}
  elif $r != null and (["parked","blocked","paused"] | index(runtime_state($r))) != null then
    {kind:(if runtime_state($r) == "paused" then "paused" else "runtime_blocked" end), reason:($r.current_state.detail // runtime_state($r)), blockerIds:[], since:null, actionableBy:"primary"}
  else null end;
def results($b; $r):
  ([if (($r.pr.url // $b.pr_url // null) | nonempty) then
      {kind:"pr", href:($r.pr.url // $b.pr_url), label:"Pull request", status:($b.state | backlog_state)}
    else empty end,
    if ($r.paths.report.present // false) then
      {kind:"report", href:("/api/artifacts/" + ($b.id | @uri) + "/report"), label:"Report", status:($b.state | backlog_state)}
    else empty end]);
. as $fleet
| ([.backlog.records[]? | select(.structured == true)] | group_by(.id)) as $groups
| ([ $groups[] | select(length == 1) | .[0]
     | . as $b | runtime_for($fleet; $b.id) as $r
     | select(($b.id | nonempty) and (($b.title // "") | nonempty) and ((($b.repo // $r.project // "")) | nonempty))
     | {id:$b.id, title:$b.title, projectId:($b.repo // $r.project), kind:($b.kind // $r.kind // "unknown"),
        backlogState:($b.state | backlog_state), phase:phase($b; $r), wait:wait($b; $r),
        runtime:{state:runtime_state($r), source:($r.current_state.source // "none"), observedAt:($r.current_state.observed_at // null)},
        results:results($b; $r)} ]) as $tasks
| ([ $groups[] | select(length > 1) | notice(.[0].id; "duplicate task id omitted") ]
   + [ $groups[] | select(length == 1) | .[0] as $b | runtime_for($fleet; $b.id) as $r
       | select((($b.id | nonempty) and (($b.title // "") | nonempty) and ((($b.repo // $r.project // "")) | nonempty)) | not)
       | notice(($b.id // "unknown"); "invalid task identity, title, or project omitted") ]
   + [if (.main_inventory.valid // true) == false then {reason:(.main_inventory.reason // "Firstmate inventory is invalid")} else empty end]) as $omitted
| {schema:"fm-task-graph.v1", observedAt:.generated,
   freshness:(if .schema == "fm-fleet-snapshot.v1" and .backlog.present == true then "current" else "unknown" end),
   provenance:{authority:"firstmate"}, tasks:$tasks,
   edges:[ $groups[] | select(length == 1) | .[0] as $b | ($b.blocked_by_ids // [])[] as $blocker
           | {type:"blocks", from:$blocker, to:$b.id, resolved:((($b.unresolved_blocker_ids // []) | index($blocker)) == null)} ],
   omitted:$omitted,
   errors:[if .schema != "fm-fleet-snapshot.v1" then {reason:"Firstmate fleet snapshot unavailable or unsupported"} else empty end]}
