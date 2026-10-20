import { useState } from 'react'
import { Button, Group, Text, Title } from '@mantine/core'
import type { OriginalInvoice } from '../model/types.ts'
import { formatInvoiceNumber } from './display.ts'
import classes from './workspace.module.css'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.25

type DocumentViewerProps = {
  invoice: OriginalInvoice | null
}

export function DocumentViewer({ invoice }: DocumentViewerProps) {
  return (
    <section className={classes.viewer} aria-label="Original document">
      {invoice ? (
        <ViewerBody
          key={invoice.document?.url ?? `missing-${invoice.id}`}
          invoice={invoice}
        />
      ) : (
        <Message
          title="No invoice selected"
          body="Select an invoice from the queue to view its original document."
        />
      )}
    </section>
  )
}

function ViewerBody({ invoice }: { invoice: OriginalInvoice }) {
  const [zoom, setZoom] = useState(1)
  const [loadFailed, setLoadFailed] = useState(false)
  const source = invoice.document
  if (!source) {
    return (
      <Message
        title="Original document unavailable"
        body={`${invoice.originalFilename} was not supplied, so this invoice cannot be checked against its source.`}
      />
    )
  }

  if (loadFailed) {
    return (
      <Message
        title="Original document could not be loaded"
        body={`${source.fileName} is listed for this invoice, but the file did not load.`}
      />
    )
  }

  const isPdf = source.mimeType === 'application/pdf'
  const isImage = source.mimeType.startsWith('image/')

  if (!isPdf && !isImage) {
    return (
      <Message
        title="Original document cannot be shown"
        body={`${source.fileName} uses ${source.mimeType}, which this viewer does not display.`}
      />
    )
  }

  return (
    <>
      <div className={classes.toolbar}>
        {isImage ? (
          <Group gap={6} role="group" aria-label="Image zoom">
            <Button
              size="compact-xs"
              variant="default"
              onClick={() => setZoom(clampZoom(zoom - ZOOM_STEP))}
              disabled={zoom <= MIN_ZOOM}
            >
              Zoom out
            </Button>
            <Text size="xs" aria-live="polite">
              {Math.round(zoom * 100)}%
            </Text>
            <Button
              size="compact-xs"
              variant="default"
              onClick={() => setZoom(clampZoom(zoom + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
            >
              Zoom in
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => setZoom(1)}
              disabled={zoom === 1}
            >
              Fit width
            </Button>
          </Group>
        ) : (
          <Text size="xs" c="dimmed">
            {source.pages} {source.pages === 1 ? 'page' : 'pages'}. Use the PDF
            viewer's own zoom controls.
          </Text>
        )}
      </div>
      <div className={classes.viewerBody}>
        {isImage ? (
          <img
            className={classes.image}
            src={source.url}
            alt={`Original invoice ${formatInvoiceNumber(invoice.fields.invoiceNumber.value)} (${invoice.id})`}
            style={{ width: `${zoom * 100}%` }}
            onError={() => setLoadFailed(true)}
          />
        ) : (
          <iframe
            className={classes.pdfFrame}
            src={source.url}
            title={`Original PDF ${invoice.id}`}
          />
        )}
      </div>
    </>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className={classes.missing}>
      <Title order={2} size="h4">
        {title}
      </Title>
      <Text size="sm" mt={8}>
        {body}
      </Text>
    </div>
  )
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}
