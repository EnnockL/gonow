create or replace function public.fn_order_to_payout_ready()
returns trigger
language plpgsql
as $$
declare
  v_carrier_id uuid;
begin
  v_carrier_id := public.fn_resolve_order_carrier_id(new);

  if new.status = 'confirmed'
     and old.status is distinct from 'confirmed'::order_status
     and v_carrier_id is not null then
    perform public.fn_append_ledger_entry(
      new.id,
      null,
      null,
      new.sender_id,
      v_carrier_id,
      'carrier_available',
      'credit',
      'carrier_available',
      new.carrier_payout,
      'Förarandel släppt efter mottagarbekräftelse',
      jsonb_build_object('from_status', old.status, 'to_status', new.status)
    );

    update public.orders
    set
      order_phase = 'payout_ready',
      receiver_confirmed_at = coalesce(new.confirmed_at, now()),
      payout_ready_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;
