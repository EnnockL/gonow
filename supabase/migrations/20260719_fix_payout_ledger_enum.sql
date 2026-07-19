create or replace function public.fn_ledger_on_payout_update()
returns trigger
language plpgsql
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = new.order_id;

  if new.status in ('pending', 'processing')
     and old.status is distinct from 'pending'::payout_status
     and old.status is distinct from 'processing'::payout_status then
    perform public.fn_append_ledger_entry(
      v_order.id, null, new.id, v_order.sender_id, new.carrier_id,
      'carrier_payout_processing', 'debit', 'carrier_in_payout', new.amount,
      'Utbetalning initierad', jsonb_build_object('provider', new.provider)
    );
  end if;

  if new.status = 'paid' and old.status is distinct from 'paid'::payout_status then
    perform public.fn_append_ledger_entry(
      v_order.id, null, new.id, v_order.sender_id, new.carrier_id,
      'carrier_payout_paid', 'debit', 'carrier_paid', new.amount,
      'Utbetalning skickad till förare', jsonb_build_object('provider', new.provider)
    );

    update public.orders
    set order_phase = 'paid_out', paid_out_at = coalesce(new.paid_at, now())
    where id = v_order.id;
  end if;

  return new;
end;
$$;
