package com.narrowgatefitness.app.runjournal;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Append-only journal of GPS fixes for one run or walk, written by native code as each fix arrives (O-01, native
 * layer). If Android pauses the web view or ends the app while the phone is locked, the route is still here; the web
 * app reads it back when it offers to continue an unfinished recording. One JSON object per line; a line cut short by
 * the app being ended is skipped on reading. Plain Java (no Android APIs) so it is unit-tested on the JVM.
 */
public final class RunJournalStore {
    /** About 50 hours at one fix a second: a runaway journal can't fill the phone. */
    public static final long MAX_BYTES = 16L * 1024 * 1024;

    private static final Pattern LINE = Pattern.compile(
        "^\\{\"lat\":(-?[0-9.]+),\"lng\":(-?[0-9.]+),\"accuracy\":([0-9.]+),\"t\":([0-9]+)\\}$");

    /** One fix: degrees, metres, and milliseconds since 1970 (as JavaScript's Date.now()). */
    public static final class Fix {
        public final double lat;
        public final double lng;
        public final double accuracy;
        public final long t;

        public Fix(double lat, double lng, double accuracy, long t) {
            this.lat = lat;
            this.lng = lng;
            this.accuracy = accuracy;
            this.t = t;
        }
    }

    private final File directory;

    public RunJournalStore(File directory) {
        this.directory = directory;
    }

    /** A safe file name for a recording key such as "run.recording.&lt;uuid&gt;". */
    public static String fileName(String key) {
        StringBuilder sb = new StringBuilder();
        for (char c : key.toCharArray()) {
            boolean ok = (c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c == '.' || c == '-' || c == '_';
            sb.append(ok ? c : '_');
            if (sb.length() >= 120) break;
        }
        return sb + ".jsonl";
    }

    File fileFor(String key) {
        return new File(directory, fileName(key));
    }

    /** Append one fix and flush it to storage. Returns false when the journal is full. */
    public synchronized boolean append(String key, Fix fix) throws IOException {
        if (!directory.exists() && !directory.mkdirs()) throw new IOException("Can't create " + directory);
        File file = fileFor(key);
        if (file.length() >= MAX_BYTES) return false;
        String line = String.format(Locale.US, "{\"lat\":%.7f,\"lng\":%.7f,\"accuracy\":%.1f,\"t\":%d}\n", fix.lat, fix.lng, fix.accuracy, fix.t);
        try (FileOutputStream out = new FileOutputStream(file, true)) {
            out.write(line.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        }
        return true;
    }

    /** Every complete fix recorded for `key`, oldest first. */
    public synchronized List<Fix> read(String key) {
        List<Fix> fixes = new ArrayList<>();
        File file = fileFor(key);
        if (!file.exists()) return fixes;
        try (BufferedReader in = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line;
            while ((line = in.readLine()) != null) {
                Matcher m = LINE.matcher(line.trim());
                if (!m.matches()) continue;
                try {
                    double lat = Double.parseDouble(m.group(1));
                    double lng = Double.parseDouble(m.group(2));
                    double accuracy = Double.parseDouble(m.group(3));
                    long t = Long.parseLong(m.group(4));
                    if (Double.isFinite(lat) && Double.isFinite(lng) && accuracy >= 0) fixes.add(new Fix(lat, lng, accuracy, t));
                } catch (NumberFormatException ignored) {
                    // a damaged line is skipped
                }
            }
        } catch (IOException ignored) {
            // unreadable: whatever was read is returned
        }
        Collections.sort(fixes, (a, b) -> Long.compare(a.t, b.t));
        return fixes;
    }

    /** Remove one recording's journal, or every journal when `key` is null (sign-out, account deletion). */
    public synchronized void clear(String key) {
        if (key != null) {
            File f = fileFor(key);
            if (f.exists() && !f.delete()) f.deleteOnExit();
            return;
        }
        File[] files = directory.listFiles();
        if (files != null) for (File f : files) if (!f.delete()) f.deleteOnExit();
        if (!directory.delete() && directory.exists()) directory.deleteOnExit();
    }
}
