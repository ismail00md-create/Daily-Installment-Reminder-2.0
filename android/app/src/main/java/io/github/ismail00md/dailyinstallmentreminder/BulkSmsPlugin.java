package io.github.ismail00md.dailyinstallmentreminder;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.telephony.SmsManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@CapacitorPlugin(
  name = "BulkSms",
  permissions = {
    @Permission(strings = { Manifest.permission.SEND_SMS }, alias = "sms")
  }
)
public class BulkSmsPlugin extends Plugin {

  private static final String ACTION_SMS_SENT = "io.github.ismail00md.dailyinstallmentreminder.SMS_SENT";
  private final AtomicInteger nextId = new AtomicInteger(1000);

  private static class PendingSend {
    PluginCall call;
    String number;
    int totalParts;
    int doneParts;
    int errors;
    int lastErrorCode;
  }

  private final ConcurrentHashMap<Integer, PendingSend> pending = new ConcurrentHashMap<>();
  private BroadcastReceiver sentReceiver;

  private void ensureReceiver() {
    if (sentReceiver != null) return;

    sentReceiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra("id", -1);
        PendingSend ps = pending.get(id);
        if (ps == null) return;

        ps.doneParts++;

        int rc = getResultCode();
        if (rc != Activity.RESULT_OK) {
          ps.errors++;
          ps.lastErrorCode = rc;
        }

        if (ps.doneParts >= ps.totalParts) {
          pending.remove(id);

          try {
            ps.call.setKeepAlive(false);
          } catch (Exception ignored) {}

          if (ps.errors == 0) {
            JSObject res = new JSObject();
            res.put("ok", true);
            res.put("number", ps.number);
            res.put("parts", ps.totalParts);
            ps.call.resolve(res);
          } else {
            ps.call.reject("SMS FAILED for " + ps.number + " resultCode=" + ps.lastErrorCode);
          }
        }
      }
    };

    getContext().registerReceiver(sentReceiver, new IntentFilter(ACTION_SMS_SENT));
  }

  @Override
  protected void handleOnDestroy() {
    try {
      if (sentReceiver != null) getContext().unregisterReceiver(sentReceiver);
    } catch (Exception ignored) {}
    sentReceiver = null;
    pending.clear();
  }

  @PluginMethod
  public void requestPermission(PluginCall call) {
    if (getPermissionState("sms") == PermissionState.GRANTED) {
      call.resolve();
      return;
    }
    requestPermissionForAlias("sms", call, "smsPermCallback");
  }

  @PermissionCallback
  private void smsPermCallback(PluginCall call) {
    if (getPermissionState("sms") == PermissionState.GRANTED) call.resolve();
    else call.reject("SMS permission denied");
  }

  @PluginMethod
  public void sendOne(PluginCall call) {
    if (getPermissionState("sms") != PermissionState.GRANTED) {
      call.reject("SMS permission not granted");
      return;
    }

    String number = call.getString("number", "");
    String message = call.getString("message", "");

    if (number == null || number.trim().isEmpty()) {
      call.reject("number required");
      return;
    }
    if (message == null || message.trim().isEmpty()) {
      call.reject("message required");
      return;
    }

    number = number.replaceAll("[^0-9+]", "");
    try {
      SmsManager sms = SmsManager.getDefault();
      ArrayList<String> parts = sms.divideMessage(message);

      int id = nextId.incrementAndGet();
      PendingSend ps = new PendingSend();
      ps.call = call;
      ps.number = number;
      ps.totalParts = parts.size();
      ps.doneParts = 0;
      ps.errors = 0;
      ps.lastErrorCode = 0;

      call.setKeepAlive(true);
      pending.put(id, ps);
      ensureReceiver();

      ArrayList<PendingIntent> sentIntents = new ArrayList<>();
      for (int i = 0; i < parts.size(); i++) {
        Intent it = new Intent(ACTION_SMS_SENT);
        it.setPackage(getContext().getPackageName());
        it.putExtra("id", id);
        it.putExtra("part", i);

        int reqCode = id * 100 + i;
        PendingIntent pi = PendingIntent.getBroadcast(
          getContext(),
          reqCode,
          it,
          PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        sentIntents.add(pi);
      }

      sms.sendMultipartTextMessage(number, null, parts, sentIntents, null);

      // resolve/reject will happen from receiver
    } catch (Exception e) {
      try { call.setKeepAlive(false); } catch (Exception ignored) {}
      pending.values().removeIf(x -> x.call == call);
      call.reject("Exception sending SMS: " + e.getMessage(), e);
    }
  }
}
