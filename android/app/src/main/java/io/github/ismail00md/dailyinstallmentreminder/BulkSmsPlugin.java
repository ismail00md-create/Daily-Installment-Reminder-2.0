package io.github.ismail00md.dailyinstallmentreminder;

import android.Manifest;
import android.telephony.SmsManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

@CapacitorPlugin(
  name = "BulkSms",
  permissions = {
    @Permission(strings = { Manifest.permission.SEND_SMS }, alias = "sms")
  }
)
public class BulkSmsPlugin extends Plugin {

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
    if (getPermissionState("sms") == PermissionState.GRANTED) {
      call.resolve();
    } else {
      call.reject("SMS permission denied");
    }
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
    try {
      number = number.replaceAll("[^0-9+]", "");
      SmsManager sms = SmsManager.getDefault();
      ArrayList<String> parts = sms.divideMessage(message);
      sms.sendMultipartTextMessage(number, null, parts, null, null);
      call.resolve();
    } catch (Exception e) {
      call.reject("Failed to send SMS: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void sendBulk(PluginCall call) {
    if (getPermissionState("sms") != PermissionState.GRANTED) {
      call.reject("SMS permission not granted");
      return;
    }

    JSArray numbers = call.getArray("numbers");
    String message = call.getString("message", "");

    if (numbers == null || numbers.length() == 0) {
      call.reject("numbers required");
      return;
    }
    if (message == null || message.trim().isEmpty()) {
      call.reject("message required");
      return;
    }

    try {
      SmsManager sms = SmsManager.getDefault();
      ArrayList<String> parts = sms.divideMessage(message);

      int sent = 0;
      for (int i = 0; i < numbers.length(); i++) {
        String num = numbers.getString(i);
        if (num == null) continue;
        num = num.replaceAll("[^0-9+]", "");
        if (num.length() < 10) continue;

        sms.sendMultipartTextMessage(num, null, parts, null, null);
        sent++;
      }

      JSObject res = new JSObject();
      res.put("sent", sent);
      call.resolve(res);
    } catch (Exception e) {
      call.reject("Failed to send SMS: " + e.getMessage(), e);
    }
  }
}
