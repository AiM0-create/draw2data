import { useState, useCallback } from 'react';
import type { AOIGeometry, ExtractionState, OutputFormat } from '../types';
import { extract } from '../core/extraction/extractor';
import { convertToFormat } from '../core/conversion';
import { downloadBlob } from '../utils/download';

export function useExtraction() {
  const [state, setState] = useState<ExtractionState>({
    status: 'idle',
    progress: '',
    result: null,
    error: null,
  });

  const runExtraction = useCallback(
    async (aoi: AOIGeometry, datasetIds: string[], format: OutputFormat) => {
      setState({ status: 'extracting', progress: 'Starting extraction...', result: null, error: null });

      try {
        const result = await extract(aoi, datasetIds, (msg) => {
          setState((prev) => ({ ...prev, progress: msg }));
        });

        if (result.features.length === 0) {
          setState({
            status: 'done',
            progress: 'No features found in this area.',
            result,
            error: null,
          });
          return;
        }

        setState((prev) => ({ ...prev, status: 'converting', progress: `Converting ${result.features.length} features to ${format}...` }));

        const { blob, filename } = await convertToFormat(result.features, format);
        downloadBlob(blob, filename);

        setState({
          status: 'done',
          progress: `Exported ${result.features.length} features in ${(result.metadata.durationMs / 1000).toFixed(1)}s`,
          result,
          error: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setState({
          status: 'error',
          progress: '',
          result: null,
          error: message,
        });
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ status: 'idle', progress: '', result: null, error: null });
  }, []);

  return { extractionState: state, runExtraction, resetExtraction: reset };
}
