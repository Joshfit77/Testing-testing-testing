package com.narrowgatefitness.app.runjournal;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;
import java.util.List;

/**
 * Records GPS fixes natively, into RunJournalStore, while a run or walk is recording.
 *
 * The background-geolocation plugin delivers fixes to the web app for the live screen and keeps the app process alive
 * with its "Recording your run" foreground service. This plugin listens to the same GPS in that process and writes
 * every fix to a file with no JavaScript involved, so the route survives the web view being paused or the app being
 * ended. It never asks for permission itself: the run screen asks when the member taps Start.
 */
@CapacitorPlugin(name = "RunJournal")
public class RunJournalPlugin extends Plugin {
    private RunJournalStore store;
    private LocationManager locationManager;
    private String activeKey;

    private final LocationListener listener = new LocationListener() {
        @Override
        public void onLocationChanged(Location location) {
            record(location);
        }

        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {}

        @Override
        public void onProviderEnabled(String provider) {}

        @Override
        public void onProviderDisabled(String provider) {}
    };

    @Override
    public void load() {
        store = new RunJournalStore(new File(getContext().getNoBackupFilesDir(), "run-journal"));
        locationManager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
    }

    @PluginMethod
    public void start(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("A recording key is required");
            return;
        }
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        JSObject ret = new JSObject();
        if (!granted || locationManager == null) {
            ret.put("recording", false);
            ret.put("authorized", granted);
            call.resolve(ret);
            return;
        }
        activeKey = key;
        try {
            locationManager.removeUpdates(listener);
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, listener, Looper.getMainLooper());
            ret.put("recording", true);
        } catch (SecurityException | IllegalArgumentException e) {
            Logger.error("RunJournal", "Could not start location updates", e);
            ret.put("recording", false);
        }
        ret.put("authorized", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopUpdates();
        call.resolve();
    }

    @PluginMethod
    public void read(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("A recording key is required");
            return;
        }
        JSArray fixes = new JSArray();
        for (RunJournalStore.Fix f : store.read(key)) {
            JSObject o = new JSObject();
            o.put("lat", f.lat);
            o.put("lng", f.lng);
            o.put("accuracy", f.accuracy);
            o.put("t", f.t);
            fixes.put(o);
        }
        JSObject ret = new JSObject();
        ret.put("fixes", fixes);
        call.resolve(ret);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.equals(activeKey)) stopUpdates();
        store.clear(key);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        stopUpdates();
    }

    private void stopUpdates() {
        activeKey = null;
        if (locationManager != null) locationManager.removeUpdates(listener);
    }

    private void record(Location location) {
        String key = activeKey;
        if (key == null || location == null || !location.hasAccuracy()) return;
        boolean mock = Build.VERSION.SDK_INT >= 31 ? location.isMock() : location.isFromMockProvider();
        if (mock) return;
        try {
            boolean ok = store.append(key, new RunJournalStore.Fix(location.getLatitude(), location.getLongitude(), location.getAccuracy(), location.getTime()));
            if (!ok) stopUpdates();
        } catch (IOException e) {
            Logger.error("RunJournal", "Could not write a fix", e);
        }
    }

    /** For tests: the fixes stored for a key. */
    List<RunJournalStore.Fix> storedFixes(String key) {
        return store.read(key);
    }
}
