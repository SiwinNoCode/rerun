-- A paid plan runs unlimited coworkers now (quantitiesToColumns): null means unlimited. The webhook
-- only rewrites the column on the next Stripe event, so a workspace already subscribed would keep
-- its pack count until its renewal. Trials keep the cap of 3 the webhook writes for them.
-- Applied after the deploy: the previous webhook would write the pack count back on the next event.
update public.workspaces
set max_agents = null
where subscription_status in ('active', 'past_due')
  and max_agents is not null
  and not is_sandbox;

-- Everyone is sold the $29 price now. A workspace that has not subscribed yet is quoted and checked
-- out at its arm, so the ones drawn at $49 move to $29. A live subscription (a trial included) keeps
-- its arm here: the trial receipt and the foreman quote the column, and Stripe still bills its $49
-- price until the migration script moves the subscription and the column together.
update public.workspaces
set price_arm = '29'
where price_arm = '49'
  and (subscription_status is null or subscription_status not in ('trialing', 'active', 'past_due'));
