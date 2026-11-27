package com.narrowgatefitness.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.narrowgatefitness.app.runjournal.RunJournalPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own native plugins (not from npm) are registered before the bridge starts.
        registerPlugin(RunJournalPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
