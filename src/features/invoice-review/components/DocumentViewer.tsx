import { useState } from 'react'
import { ActionIcon, Button, Group, Text, Title, Tooltip } from '@mantine/core'
import type { OriginalInvoice } from '../model/types.ts'
import { formatInvoiceNumber } from './display.ts'
import { DOCUMENT_REGION_ID } from './field-ids.ts'
import classes from './workspace.module.css'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.25

type DocumentViewerProps = {
  invoice: OriginalInvoice | null
}

export function DocumentViewer({ invoice }: DocumentViewerProps) {
  return (
    <section
      id={DOCUMENT_REGION_ID}
      className={classes.viewer}
      aria-label="Original document"
      tabIndex={-1}
    >
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
        body={`${invoice.originalFilename} was not supplied, so this invoice cannot be checked against its source. Set it aside from the review panel if the source cannot be checked.`}
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
        <span className={classes.toolbarTitle}>
          <DocumentIcon />
          Original document
        </span>
        {isImage ? (
          <Group gap={4} role="group" aria-label="Image zoom" wrap="nowrap">
            <Tooltip label="Zoom out">
              <ActionIcon
                className={classes.iconButton}
                variant="default"
                aria-label="Zoom out"
                onClick={() => setZoom(clampZoom(zoom - ZOOM_STEP))}
                disabled={zoom <= MIN_ZOOM}
              >
                <MinusIcon />
              </ActionIcon>
            </Tooltip>
            <Text className={classes.zoomLabel} aria-live="polite">
              {Math.round(zoom * 100)}%
            </Text>
            <Tooltip label="Zoom in">
              <ActionIcon
                className={classes.iconButton}
                variant="default"
                aria-label="Zoom in"
                onClick={() => setZoom(clampZoom(zoom + ZOOM_STEP))}
                disabled={zoom >= MAX_ZOOM}
              >
                <PlusIcon />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Fit the document to the viewer width">
              <Button
                size="sm"
                variant="subtle"
                color="gray"
                onClick={() => setZoom(1)}
                disabled={zoom === 1}
              >
                Fit width
              </Button>
            </Tooltip>
          </Group>
        ) : (
          <Text className={classes.pdfNote}>
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
    <div className={classes.statusCard} role="status">
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

function DocumentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.5 1.75h6.1L12.5 4.7v9.55H3.5V1.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M9.2 1.9v3.1h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M3 7h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M7 3v8M3 7h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
