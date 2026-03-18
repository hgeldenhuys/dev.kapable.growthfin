/**
 * Device Confirmation Page
 * Allows users to confirm device authentication codes
 */

import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from 'react-router';
import { Form, useActionData, useLoaderData } from 'react-router';
import { auth } from '@agios/api-client';

export async function loader({ request }: LoaderFunctionArgs) {
  // Forward cookies from the browser request to the API
  const cookieHeader = request.headers.get('Cookie');

  // Check if user is authenticated
  const session = await auth.getSession({
    baseUrl: process.env.API_URL || 'http://localhost:3000',
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });

  if (!session || !session.user) {
    // Redirect to login if not authenticated
    const url = new URL(request.url);
    return redirect(`/login?redirect=${encodeURIComponent(url.pathname)}`);
  }

  return { user: session.user };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const userCode = formData.get('userCode') as string;

  if (!userCode || userCode.length !== 6) {
    return { error: 'Please enter a valid 6-character code' };
  }

  try {
    // Forward cookies from the browser request to the API
    const cookieHeader = request.headers.get('Cookie');

    const response = await fetch(`${process.env.API_URL || 'http://localhost:3000'}/auth/device/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ userCode: userCode.toUpperCase() }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || 'Failed to confirm device' };
    }

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to confirm device',
    };
  }
}

export default function DevicePage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Confirm Device
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Logged in as <span className="font-medium">{user?.email}</span>
          </p>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter the code displayed in your terminal
          </p>
        </div>

        {actionData?.success ? (
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Device Confirmed!
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>
                    Your CLI is now authenticated. You can close this window and
                    return to your terminal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Form method="post" className="mt-8 space-y-6">
            {actionData?.error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {actionData.error}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="userCode" className="sr-only">
                Device Code
              </label>
              <input
                id="userCode"
                name="userCode"
                type="text"
                required
                maxLength={6}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 text-center text-2xl font-mono uppercase tracking-widest focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-3xl"
                placeholder="ABC123"
                autoComplete="off"
                autoFocus
                style={{ letterSpacing: '0.5em' }}
              />
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Confirm Device
              </button>
            </div>
          </Form>
        )}

        <div className="text-center">
          <a
            href="/dashboard"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
