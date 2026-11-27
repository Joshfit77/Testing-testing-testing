package com.narrowgatefitness.app.runjournal;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/** The native run journal (O-01, native layer): written per fix, per recording, robust to a cut-off line, clearable. */
public class RunJournalStoreTest {
    private File dir;
    private RunJournalStore store;

    @Before
    public void setUp() throws Exception {
        dir = new File(Files.createTempDirectory("rj").toFile(), "run-journal");
        store = new RunJournalStore(dir);
    }

    @After
    public void tearDown() {
        store.clear(null);
    }

    private static RunJournalStore.Fix fix(int i) {
        return new RunJournalStore.Fix(40 + i * 0.0001, -75, 5, 1_790_000_000_000L + i * 1000L);
    }

    @Test
    public void appendsAndReadsBackInOrder() throws Exception {
        for (int i = 0; i < 120; i++) assertTrue(store.append("run.recording.a", fix(i)));
        List<RunJournalStore.Fix> back = store.read("run.recording.a");
        assertEquals(120, back.size());
        assertEquals(fix(0).t, back.get(0).t);
        assertEquals(fix(119).lat, back.get(119).lat, 1e-7);
    }

    @Test
    public void recordingsAreSeparateAndKeysAreMadeSafe() throws Exception {
        store.append("run.recording.a", fix(1));
        store.append("run.recording.b", fix(2));
        store.append("../../etc/passwd", fix(3));
        assertEquals(1, store.read("run.recording.a").size());
        assertEquals(1, store.read("run.recording.b").size());
        assertEquals(".._.._etc_passwd.jsonl", RunJournalStore.fileName("../../etc/passwd"));
        for (String name : dir.list()) assertFalse(name.contains("/"));
    }

    @Test
    public void aLineCutShortByTheAppEndingIsSkipped() throws Exception {
        store.append("k", fix(1));
        store.append("k", fix(2));
        try (FileOutputStream out = new FileOutputStream(store.fileFor("k"), true)) {
            out.write("{\"lat\":40.1,\"lng\":-7".getBytes(StandardCharsets.UTF_8));
        }
        assertEquals(2, store.read("k").size());
    }

    @Test
    public void clearOneAndClearAll() throws Exception {
        store.append("a", fix(1));
        store.append("b", fix(2));
        // Deletion is confirmed, not assumed.
        assertTrue(store.clear("a"));
        assertTrue(store.read("a").isEmpty());
        assertFalse(store.fileFor("a").exists());
        assertEquals(1, store.read("b").size());
        assertTrue(store.clear("a")); // nothing left to delete: still confirmed
        assertTrue(store.clear(null));
        assertTrue(store.read("b").isEmpty());
        assertFalse(dir.exists());
    }

    @Test
    public void missingJournalReadsEmpty() {
        assertTrue(store.read("never-written").isEmpty());
    }
}
