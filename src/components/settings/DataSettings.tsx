import { Archive, Download, FileJson } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export default function DataSettings() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <Archive className="h-4 w-4" /> Full backup
          </CardTitle>
          <CardDescription>
            One zip with a consistent copy of the database, every uploaded document and every sent PDF, plus a README
            on restoring it. Keep one somewhere off the server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href="/api/backup" data-testid="download-backup-btn">
              <Download className="mr-2 h-4 w-4" /> Download backup
            </a>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <FileJson className="h-4 w-4" /> Experience bank
          </CardTitle>
          <CardDescription>
            Your bank and base versions as a JSON file. Import it from the Experience Bank page on another JobSync, or
            hand it to Claude as context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="/api/bank/export">
              <Download className="mr-2 h-4 w-4" /> Export bank
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
