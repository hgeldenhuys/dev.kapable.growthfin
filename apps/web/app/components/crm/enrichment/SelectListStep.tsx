/**
 * SelectListStep Component
 * Step 1: Select source contact list for enrichment
 */

import { Loader2, Users, DollarSign, TrendingUp, Check } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import type { ContactList } from '~/types/crm';

interface SelectListStepProps {
  lists: ContactList[];
  isLoading: boolean;
  selectedListId: string | null;
  onSelectList: (listId: string) => void;
  onNext: () => void;
}

export function SelectListStep({
  lists,
  isLoading,
  selectedListId,
  onSelectList,
  onNext,
}: SelectListStepProps) {
  const selectedList = lists.find((l) => l.id === selectedListId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-2">Step 1</p>
        <h2 className="text-2xl font-bold">Select Contact List</h2>
        <p className="text-muted-foreground mt-1">
          Choose which contact list you want to enrich with AI scoring
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source List</CardTitle>
          <CardDescription>
            Select a contact list to run enrichment on all its contacts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No contact lists available. Create a contact list first.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {lists.map((list) => (
                <Card
                  key={list.id}
                  data-testid={`list-card-${list.name}`}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedListId === list.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => onSelectList(list.id)}
                >
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{list.name}</h3>
                          {list.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {list.description}
                            </p>
                          )}
                        </div>
                        {selectedListId === list.id && (
                          <div className="rounded-full bg-primary p-1">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{list.totalContacts} contacts</span>
                      </div>

                      {list.budgetLimit && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Budget</span>
                            </div>
                            <span className="font-medium">
                              ${parseFloat(list.budgetLimit).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Spent</span>
                            </div>
                            <span className="font-medium">
                              ${list.totalSpent ? parseFloat(list.totalSpent).toFixed(2) : '0.00'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!selectedListId} size="lg">
          Next: Configure Prompt
        </Button>
      </div>
    </div>
  );
}
