package job_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"

	"github.com/sourcegraph/sourcegraph/enterprise/cmd/executor/internal/apiclient"
	"github.com/sourcegraph/sourcegraph/enterprise/cmd/executor/internal/apiclient/queue"
	"github.com/sourcegraph/sourcegraph/enterprise/cmd/executor/internal/apiclient/queue/job"
	"github.com/sourcegraph/sourcegraph/internal/observation"
	"github.com/sourcegraph/sourcegraph/internal/workerutil"
)

func TestAddExecutionLogEntry(t *testing.T) {
	entry := workerutil.ExecutionLogEntry{
		Key:        "foo",
		Command:    []string{"ls", "-a"},
		StartTime:  time.Unix(1587396557, 0).UTC(),
		ExitCode:   intptr(123),
		Out:        "<log payload>",
		DurationMs: intptr(23123),
	}

	spec := routeSpec{
		expectedMethod:   "POST",
		expectedPath:     "/.executors/queue/test_queue/addExecutionLogEntry",
		expectedUsername: "test",
		expectedToken:    "job-token",
		expectedPayload: `{
			"executorName": "deadbeef",
			"jobId": 42,
			"key": "foo",
			"command": ["ls", "-a"],
			"startTime": "2020-04-20T15:29:17Z",
			"exitCode": 123,
			"out": "<log payload>",
			"durationMs": 23123
		}`,
		responseStatus:  http.StatusOK,
		responsePayload: `99`,
	}

	testRoute(t, spec, func(client *job.Client) {
		entryID, err := client.AddExecutionLogEntry(context.Background(), "job-token", "test_queue", 42, entry)
		if err != nil {
			t.Fatalf("unexpected error updating log contents: %s", err)
		}
		if entryID != 99 {
			t.Fatalf("unexpected entryID returned. want=%d, have=%d", 99, entryID)
		}
	})
}

func TestAddExecutionLogEntryBadResponse(t *testing.T) {
	entry := workerutil.ExecutionLogEntry{
		Key:        "foo",
		Command:    []string{"ls", "-a"},
		StartTime:  time.Unix(1587396557, 0).UTC(),
		ExitCode:   intptr(123),
		Out:        "<log payload>",
		DurationMs: intptr(23123),
	}

	spec := routeSpec{
		expectedMethod:   "POST",
		expectedPath:     "/.executors/queue/test_queue/addExecutionLogEntry",
		expectedUsername: "test",
		expectedToken:    "job-token",
		expectedPayload: `{
			"executorName": "deadbeef",
			"jobId": 42,
			"key": "foo",
			"command": ["ls", "-a"],
			"startTime": "2020-04-20T15:29:17Z",
			"exitCode": 123,
			"out": "<log payload>",
			"durationMs": 23123
		}`,
		responseStatus:  http.StatusInternalServerError,
		responsePayload: ``,
	}

	testRoute(t, spec, func(client *job.Client) {
		if _, err := client.AddExecutionLogEntry(context.Background(), "job-token", "test_queue", 42, entry); err == nil {
			t.Fatalf("expected an error")
		}
	})
}

func TestUpdateExecutionLogEntry(t *testing.T) {
	entry := workerutil.ExecutionLogEntry{
		Key:        "foo",
		Command:    []string{"ls", "-a"},
		StartTime:  time.Unix(1587396557, 0).UTC(),
		ExitCode:   intptr(123),
		Out:        "<log payload>",
		DurationMs: intptr(23123),
	}

	spec := routeSpec{
		expectedMethod:   "POST",
		expectedPath:     "/.executors/queue/test_queue/updateExecutionLogEntry",
		expectedUsername: "test",
		expectedToken:    "job-token",
		expectedPayload: `{
			"executorName": "deadbeef",
			"jobId": 42,
			"entryId": 99,
			"key": "foo",
			"command": ["ls", "-a"],
			"startTime": "2020-04-20T15:29:17Z",
			"exitCode": 123,
			"out": "<log payload>",
			"durationMs": 23123
		}`,
		responseStatus:  http.StatusNoContent,
		responsePayload: ``,
	}

	testRoute(t, spec, func(client *job.Client) {
		if err := client.UpdateExecutionLogEntry(context.Background(), "job-token", "test_queue", 42, 99, entry); err != nil {
			t.Fatalf("unexpected error updating log contents: %s", err)
		}
	})
}

func TestUpdateExecutionLogEntryBadResponse(t *testing.T) {
	entry := workerutil.ExecutionLogEntry{
		Key:        "foo",
		Command:    []string{"ls", "-a"},
		StartTime:  time.Unix(1587396557, 0).UTC(),
		ExitCode:   intptr(123),
		Out:        "<log payload>",
		DurationMs: intptr(23123),
	}

	spec := routeSpec{
		expectedMethod:   "POST",
		expectedPath:     "/.executors/queue/test_queue/updateExecutionLogEntry",
		expectedUsername: "test",
		expectedToken:    "job-token",
		expectedPayload: `{
			"executorName": "deadbeef",
			"jobId": 42,
			"entryId": 99,
			"key": "foo",
			"command": ["ls", "-a"],
			"startTime": "2020-04-20T15:29:17Z",
			"exitCode": 123,
			"out": "<log payload>",
			"durationMs": 23123
		}`,
		responseStatus:  http.StatusInternalServerError,
		responsePayload: ``,
	}

	testRoute(t, spec, func(client *job.Client) {
		if err := client.UpdateExecutionLogEntry(context.Background(), "job-token", "test_queue", 42, 99, entry); err == nil {
			t.Fatalf("expected an error")
		}
	})
}

type routeSpec struct {
	expectedMethod   string
	expectedPath     string
	expectedUsername string
	expectedToken    string
	expectedPayload  string
	responseStatus   int
	responsePayload  string
}

func testRoute(t *testing.T, spec routeSpec, f func(client *job.Client)) {
	ts := testServer(t, spec)
	defer ts.Close()

	options := queue.Options{
		ExecutorName: "deadbeef",
		BaseClientOptions: apiclient.BaseClientOptions{
			EndpointOptions: apiclient.EndpointOptions{
				URL:        ts.URL,
				PathPrefix: "/.executors/queue",
				Token:      "hunter2",
			},
		},
	}

	client, err := job.New(&observation.TestContext, options, prometheus.GathererFunc(func() ([]*dto.MetricFamily, error) { return nil, nil }))
	require.NoError(t, err)
	f(client)
}

func testServer(t *testing.T, spec routeSpec) *httptest.Server {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != spec.expectedMethod {
			t.Errorf("unexpected method. want=%s have=%s", spec.expectedMethod, r.Method)
		}
		if r.URL.Path != spec.expectedPath {
			t.Errorf("unexpected method. want=%s have=%s", spec.expectedPath, r.URL.Path)
		}

		parts := strings.Split(r.Header.Get("Authorization"), " ")
		if len(parts) != 2 || parts[0] != "token-executor" {
			if parts[1] != spec.expectedToken {
				t.Errorf("unexpected token`. want=%s have=%s", spec.expectedToken, parts[1])
			}
		}

		content, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("unexpected error reading payload: %s", err)
		}
		if diff := cmp.Diff(normalizeJSON([]byte(spec.expectedPayload)), normalizeJSON(content)); diff != "" {
			t.Errorf("unexpected request payload (-want +got):\n%s", diff)
		}

		w.WriteHeader(spec.responseStatus)
		w.Write([]byte(spec.responsePayload))
	}

	return httptest.NewServer(http.HandlerFunc(handler))
}

func normalizeJSON(v []byte) string {
	temp := map[string]any{}
	_ = json.Unmarshal(v, &temp)
	v, _ = json.Marshal(temp)
	return string(v)
}

func intptr(v int) *int { return &v }
